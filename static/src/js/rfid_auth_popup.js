odoo.define('pos_rfid_auth.rfid_auth_popup', function (require) {
  "use strict";

  var PopupWidget = require('point_of_sale.popups');
  var gui = require('point_of_sale.gui');
  var core = require('web.core');
  var QWeb = core.qweb;
  var _t = core._t;

  /**
   * RFID Authentication Popup
   * Handles both PIN and RFID card authentication
   */
  var RfidAuthPopupWidget = PopupWidget.extend({
    template: 'RfidAuthPopupWidget',

    init: function (parent, args) {
      this._super(parent, args);
      this.rfid_reader = null;
      this.waiting_for_rfid = false;
      this.pin_value = '';
      this.authentication_method = 'both'; // 'pin', 'rfid', 'both'
    },

    events: {
      'click .cancel-auth': 'click_cancel',
      'click .pin-submit': 'submit_pin',

      'keypress .pin-input': 'keypress_pin',
      'keydown .pin-input': 'keydown_pin',
      'input .pin-input': 'input_pin',
      'click .pin-input': 'click_pin_input'
    },

    show: function (options) {
      var self = this;
      this._super(options);

      // Set authentication method
      this.authentication_method = options.method || 'both';

      // Initialize RFID reader if available
      if (this.pos.rfid_reader) {
        this.rfid_reader = this.pos.rfid_reader;
        this.setup_rfid_listener();
      }

      // Ensure popup is properly styled and positioned above overlay
      this.$el.css({
        'z-index': '10100',
        'position': 'relative',
        'overflow': 'hidden'
      });

      // Focus on PIN input with better timing and event handling
      setTimeout(function () {
        var pin_input = self.$('.pin-input');
        if (pin_input.length > 0 && self.authentication_method !== 'rfid') {
          pin_input.focus();
          pin_input.click(); // Ensure it's properly focused
          // console.log('PIN input focused');
        }
      }, 300); // Increased delay to ensure popup is fully rendered

      // Start waiting for RFID
      this.start_rfid_wait();

      // Update UI based on authentication method
      this.update_auth_method_ui();

      // Ensure keyboard events work in popup
      this.setup_keyboard_events();


    },

    /**
 * Setup RFID reader event listener
 */
    setup_rfid_listener: function () {
      var self = this;

      this.rfid_reader.off('card_scanned', this, this.on_card_scanned);
      this.rfid_reader.on('card_scanned', this, this.on_card_scanned);
    },

    /**
     * Setup keyboard events to work properly with screen lock
     */
    setup_keyboard_events: function () {
      var self = this;

      // Ensure all keyboard events in this popup are not blocked
      this.$el.on('keydown keyup keypress input', function (e) {
        e.stopPropagation(); // Prevent screen lock from blocking events
      });

      // Special handling for PIN input
      this.$('.pin-input').on('focus', function () {
        // console.log('PIN input gained focus');
      });
    },

    /**
     * Handle RFID card scan
     */
    on_card_scanned: function (event) {
      var card_id = event.card_id;
      this.process_rfid_authentication(card_id);
    },

    /**
     * Process RFID authentication
     */
    process_rfid_authentication: function (card_id) {
      var self = this;

      // Update UI to show card detected
      this.set_rfid_status('success', _t('¡Tarjeta detectada!'));

      // Get PIN if required
      var pin = null;
      if (this.authentication_method !== 'rfid') {
        pin = this.pin_value || this.$('.pin-input').val();
      }

      // Authenticate with backend
      this.authenticate_user(card_id, pin);
    },

    /**
 * Authenticate user with RFID and/or PIN
 */
    authenticate_user: function (rfid_card_id, pin) {
      var self = this;

      // console.log('authenticate_user called with rfid_card_id:', rfid_card_id, 'pin:', pin ? '***' : 'null');

      // Show loading state
      this.set_auth_status(_t('Autenticando...'));

      // Use Odoo 12 compatible RPC call
      var rpc_call = this._rpc({
        model: 'res.users',
        method: 'authenticate_rfid',
        args: [rfid_card_id, pin]
      });

      // Handle the response
      if (rpc_call && typeof rpc_call.then === 'function') {
        // Standard promise
        rpc_call.then(function (user) {
          // console.log('Authentication response:', user);
          if (user) {
            self.authentication_success(user);
          } else {
            // console.log('Authentication failed - no user returned');
            self.authentication_failed();
          }
        }).fail(function (error) {
          console.error('Authentication error:', error);
          self.set_auth_status(_t('Error de autenticación: ') + (error.message || error.data.message || 'Error desconocido'));
          self.authentication_failed();
        });
      } else {
        // Fallback: Handle as direct response or callback
        try {
          if (rpc_call) {
            // console.log('Authentication response (direct):', rpc_call);
            if (rpc_call.result || rpc_call.id) {
              self.authentication_success(rpc_call.result || rpc_call);
            } else {
              self.authentication_failed();
            }
          } else {
            // console.log('No response from RPC call');
            self.authentication_failed();
          }
        } catch (error) {
          console.error('Authentication processing error:', error);
          self.set_auth_status(_t('Error de autenticación: ') + error.message);
          self.authentication_failed();
        }
      }
    },

    /**
     * Handle successful authentication
     */
    authentication_success: function (user) {
      var self = this;

      // Update UI
      this.set_auth_status(_t('¡Autenticación exitosa!'));
      this.set_rfid_status('success', _t('Acceso concedido'));

      // Close popup after delay
      setTimeout(function () {
        self.gui.close_popup();

        // Call success callback
        if (self.options.confirm) {
          self.options.confirm.call(self, user);
        }
      }, 1000);
    },

    /**
     * Handle failed authentication
     */
    authentication_failed: function () {
      var self = this;

      // Update UI
      this.set_auth_status(_t('¡Autenticación fallida!'));
      this.set_rfid_status('error', _t('Acceso denegado'));

      // Reset after delay
      setTimeout(function () {
        self.reset_authentication();
      }, 2000);
    },

    /**
     * Reset authentication state
     */
    reset_authentication: function () {
      this.pin_value = '';
      this.$('.pin-input').val('').focus();

      // Set appropriate message based on authentication method
      if (this.authentication_method === 'rfid') {
        this.set_auth_status(_t('Escanee su tarjeta RFID para acceder'));
      } else if (this.authentication_method === 'pin') {
        this.set_auth_status(_t('Ingrese su PIN para acceder'));
      } else {
        this.set_auth_status(_t('Por favor escanee su tarjeta RFID o ingrese PIN'));
      }

      this.start_rfid_wait();
    },

    /**
     * Start waiting for RFID
     */
    start_rfid_wait: function () {
      this.waiting_for_rfid = true;

      if (this.authentication_method === 'rfid') {
        this.set_rfid_status('waiting', _t('Esperando tarjeta RFID...'));
      } else {
        this.set_rfid_status('waiting', _t('Esperando tarjeta...'));
      }
    },

    /**
     * Set authentication status message
     */
    set_auth_status: function (message) {
      this.$('.status-text').text(message);
    },

    /**
     * Set RFID status
     */
    set_rfid_status: function (status, message) {
      var $rfid_section = this.$('.rfid-section');
      var $rfid_status = this.$('.rfid-status');

      // Remove all status classes
      $rfid_section.removeClass('waiting active error');
      $rfid_status.removeClass('waiting success error');

      // Add new status class
      $rfid_section.addClass(status === 'waiting' ? 'waiting' : (status === 'success' ? 'active' : 'error'));
      $rfid_status.addClass(status);

      // Update message
      $rfid_status.text(message);
    },

    /**
     * Update UI based on authentication method
     */
    update_auth_method_ui: function () {
      if (this.authentication_method === 'rfid') {
        this.$('.pin-section').hide();
        this.$('.divider').hide();
        // Update status text for RFID-only mode
        this.set_auth_status(_t('Escanee su tarjeta RFID para acceder'));
      } else if (this.authentication_method === 'pin') {
        this.$('.rfid-section').hide();
        this.$('.divider').hide();
        this.set_auth_status(_t('Ingrese su PIN para acceder'));
      }
    },

    /**
     * Handle PIN input
     */
    input_pin: function (event) {
      event.stopPropagation(); // Prevent screen lock from intercepting
      this.pin_value = $(event.target).val();
      // console.log('PIN value updated:', this.pin_value);
    },

    /**
     * Handle keypress in PIN input
     */
    keypress_pin: function (event) {
      if (event.which === 13) { // Enter key
        this.submit_pin();
      }
    },

    /**
     * Handle keydown in PIN input (for better keyboard support)
     */
    keydown_pin: function (event) {
      // Allow all normal keyboard input
      event.stopPropagation(); // Prevent screen lock from intercepting

      if (event.which === 13) { // Enter key
        this.submit_pin();
      }
    },

    /**
     * Handle click on PIN input to ensure focus
     */
    click_pin_input: function (event) {
      var pin_input = $(event.target);
      pin_input.focus();
      // console.log('PIN input clicked and focused');
    },

    /**
     * Submit PIN authentication
     */
    submit_pin: function () {
      // console.log('submit_pin function called!');
      var pin = this.$('.pin-input').val();
      // console.log('submit_pin called with PIN:', pin, 'method:', this.authentication_method);

      if (!pin) {
        // console.log('No PIN entered');
        this.set_auth_status(_t('Por favor ingrese su PIN'));
        return;
      }

      // Store the PIN value
      this.pin_value = pin;

      // For PIN-only authentication or when user wants to try PIN first
      if (this.authentication_method === 'pin' || this.authentication_method === 'both') {
        // console.log('Attempting PIN authentication');
        this.set_auth_status(_t('Autenticando...'));

        // Try simple PIN validation first
        this.validate_pin_simple(pin);
      } else {
        // RFID-only mode - store PIN and wait for RFID
        // console.log('RFID-only mode, storing PIN');
        this.set_auth_status(_t('Ahora escanee su tarjeta RFID'));
      }
    },

    /**
     * Simple PIN validation using POS users
     */
    validate_pin_simple: function (pin) {
      var self = this;
      // console.log('validate_pin_simple called with PIN:', pin);

      // Get all POS users
      var users = this.pos.users;
      // console.log('Available users:', users);

      // Find user with matching PIN
      var user = null;
      for (var i = 0; i < users.length; i++) {
        if (users[i].pos_security_pin === pin) {
          user = users[i];
          break;
        }
      }

      if (user) {
        // console.log('PIN matched user:', user.name);
        this.authentication_success(user);
      } else {
        // console.log('No user found with PIN:', pin);
        // Try alternative authentication using session
        this.authenticate_user_alternative(null, pin);
      }
    },

    /**
     * Alternative authentication method using session RPC
     */
    authenticate_user_alternative: function (rfid_card_id, pin) {
      var self = this;
      // console.log('authenticate_user_alternative called');

      try {
        // Use session.rpc for better Odoo 12 compatibility
        this.getSession().rpc('/web/dataset/call_kw', {
          model: 'res.users',
          method: 'authenticate_rfid',
          args: [rfid_card_id, pin],
          kwargs: {}
        }).then(function (result) {
          // console.log('Alternative authentication response:', result);
          if (result && result.id) {
            self.authentication_success(result);
          } else {
            // console.log('Alternative authentication failed');
            self.authentication_failed();
          }
        }).fail(function (error) {
          console.error('Alternative authentication error:', error);
          self.set_auth_status(_t('Autenticación fallida'));
          self.authentication_failed();
        });
      } catch (error) {
        console.error('Alternative authentication exception:', error);
        // Final fallback - just show failure
        this.set_auth_status(_t('Autenticación fallida - PIN inválido'));
        this.authentication_failed();
      }
    },



    /**
 * Handle cancel button
 */
    click_cancel: function () {
      // Restore screen lock overlay z-index if authentication was cancelled
      if (this.pos.screen_locker && this.pos.screen_locker.restore_lock_overlay_z_index) {
        this.pos.screen_locker.restore_lock_overlay_z_index();
      }

      this.gui.close_popup();

      if (this.options.cancel) {
        this.options.cancel.call(this);
      }
    },

    /**
 * Close popup and cleanup
 */
    close: function () {
      // Restore screen lock overlay z-index when popup closes
      if (this.pos.screen_locker && this.pos.screen_locker.restore_lock_overlay_z_index) {
        this.pos.screen_locker.restore_lock_overlay_z_index();
      }

      if (this.rfid_reader) {
        this.rfid_reader.off('card_scanned', this, this.on_card_scanned);
      }
      this._super();
    },

    /**
     * Render element
     */
    renderElement: function () {
      this._super();
      this.$('.popup').addClass('popup-rfid-auth');
      this.$('.modal-dialog').addClass('rfid-auth-popup');

      // Ensure proper z-index and pointer events
      this.$el.css({
        'z-index': '10100',
        'pointer-events': 'auto'
      });

      // Ensure all child elements have pointer events enabled
      this.$('*').css('pointer-events', 'auto');
    }

  });

  // Register the popup
  gui.define_popup({
    name: 'rfid_auth',
    widget: RfidAuthPopupWidget
  });

  return RfidAuthPopupWidget;

});