odoo.define('pos_rfid_auth.main', function (require) {
  "use strict";

  var models = require('point_of_sale.models');
  var screens = require('point_of_sale.screens');
  var chrome = require('point_of_sale.chrome');
  var core = require('web.core');
  var gui = require('point_of_sale.gui');

  var RfidReader = require('pos_rfid_auth.rfid_reader');
  var ScreenLocker = require('pos_rfid_auth.screen_locker');
  var RfidAuthPopup = require('pos_rfid_auth.rfid_auth_popup');

  var _t = core._t;

  // Store global reference to POS for keyboard shortcuts
  var current_pos_instance = null;

  // Load RFID-related fields in POS config
  models.load_fields('pos.config', [
    'enable_rfid_auth',
    'rfid_auto_lock',
    'rfid_lock_timeout',
    'rfid_require_pin',
    'rfid_only_mode'
  ]);

  // Load RFID-related fields in users
  models.load_fields('res.users', [
    'rfid_card_id',
    'pos_require_rfid',
    'pos_rfid_pin_combination'
  ]);

  // Extend PosModel to add RFID functionality
  var _super_posmodel = models.PosModel.prototype;
  models.PosModel = models.PosModel.extend({

    initialize: function (session, attributes) {
      var self = this;
      _super_posmodel.initialize.call(this, session, attributes);

      // Store global reference for keyboard shortcuts
      current_pos_instance = this;

      // Initialize RFID components after POS is ready
      this.ready.then(function () {
        if (self.config.enable_rfid_auth) {
          self.init_rfid_system();
        }
      });
    },

    /**
 * Initialize RFID authentication system
 */
    init_rfid_system: function () {
      var self = this;

      // Initialize RFID reader
      this.rfid_reader = new RfidReader(this);

      // Initialize screen locker
      this.screen_locker = new ScreenLocker(this);

      // Setup event handlers
      this.setup_rfid_events();

      // console.log('RFID Authentication system initialized');

      // Lock screen on startup for security
      setTimeout(function () {
        self.lock_screen();
        // console.log('POS screen locked on startup for security');
      }, 1000); // Small delay to ensure UI is ready
    },

    /**
     * Setup RFID event handlers
     */
    setup_rfid_events: function () {
      var self = this;

      // Handle RFID card scans
      this.rfid_reader.on('card_scanned', this, function (event) {
        self.handle_rfid_scan(event.card_id);
      });

      // Handle screen lock events
      this.screen_locker.on('authentication_requested', this, function () {
        self.show_rfid_authentication();
      });

      // Handle screen lock/unlock
      this.screen_locker.on('screen_locked', this, function () {
        // console.log('POS screen has been locked');
      });

      this.screen_locker.on('screen_unlocked', this, function () {
        // console.log('POS screen has been unlocked');
      });
    },

    /**
     * Handle RFID card scan
     */
    handle_rfid_scan: function (card_id) {
      var self = this;

      // If screen is locked, try to unlock with RFID
      if (this.screen_locker && this.screen_locker.is_screen_locked()) {
        this.authenticate_rfid_unlock(card_id);
      } else {
        // Normal RFID authentication for user switching
        this.authenticate_rfid_user(card_id);
      }
    },

    /**
     * Authenticate RFID for screen unlock
     */
    authenticate_rfid_unlock: function (card_id) {
      var self = this;

      // Find user with this RFID card
      var user = this.find_user_by_rfid(card_id);

      if (user) {
        // Check if PIN is required
        if (user.pos_rfid_pin_combination || this.config.rfid_require_pin) {
          // Show authentication popup with PIN requirement unless in RFID-only mode
          var method = this.config.rfid_only_mode ? 'rfid' : 'both';
          this.show_rfid_authentication({
            method: method,
            card_id: card_id,
            user: user
          });
        } else {
          // Direct unlock
          this.unlock_with_user(user);
        }
      } else {
        // Unknown card, show authentication popup
        var method = this.config.rfid_only_mode ? 'rfid' : 'both';
        this.show_rfid_authentication({
          method: method,
          card_id: card_id
        });
      }
    },

    /**
     * Authenticate RFID for user switching
     */
    authenticate_rfid_user: function (card_id) {
      var self = this;
      var user = this.find_user_by_rfid(card_id);

      if (user) {
        // Check if PIN is required for this user
        if (user.pos_rfid_pin_combination && user.pos_security_pin) {
          this.gui.ask_password(user.pos_security_pin).then(function () {
            self.set_cashier(user);
            self.chrome.widget.username.renderElement();
          });
        } else {
          // Direct user switch
          this.set_cashier(user);
          this.chrome.widget.username.renderElement();
        }
      } else {
        // Unknown RFID card
        this.gui.show_popup('error', {
          title: _t('Tarjeta Desconocida'),
          body: _t('La tarjeta escaneada no está registrada a ningún usuario.')
        });
      }
    },

    /**
     * Find user by RFID card ID
     */
    find_user_by_rfid: function (card_id) {
      for (var i = 0; i < this.users.length; i++) {
        if (this.users[i].rfid_card_id === card_id) {
          return this.users[i];
        }
      }
      return null;
    },

    /**
     * Show RFID authentication popup
     */
    show_rfid_authentication: function (options) {
      var self = this;
      options = options || {};

      // Determine authentication method
      var method = options.method || 'both';
      if (this.config.rfid_only_mode) {
        method = 'rfid';  // Force RFID-only mode if configured
      }

      this.gui.show_popup('rfid_auth', {
        title: _t('Autenticación Requerida'),
        method: method,
        card_id: options.card_id,
        user: options.user,
        confirm: function (user) {
          if (self.screen_locker && self.screen_locker.is_screen_locked()) {
            self.unlock_with_user(user);
          } else {
            // Set as current cashier
            self.set_cashier(user);
            self.chrome.widget.username.renderElement();
          }
        },
        cancel: function () {
          // console.log('Authentication cancelled');
        }
      });
    },

    /**
     * Unlock screen with authenticated user
     */
    unlock_with_user: function (user) {
      // Set user as current cashier
      this.set_cashier(user);
      this.chrome.widget.username.renderElement();

      // Unlock screen
      if (this.screen_locker) {
        this.screen_locker.force_unlock();
      }
    },

    /**
     * Lock the POS screen
     */
    lock_screen: function () {
      if (this.screen_locker) {
        this.screen_locker.force_lock();
      }
    },

    /**
     * Check if RFID authentication is enabled
     */
    is_rfid_enabled: function () {
      return this.config.enable_rfid_auth;
    },

    /**
     * Get RFID reader instance
     */
    get_rfid_reader: function () {
      return this.rfid_reader;
    },

    /**
     * Get screen locker instance
     */
    get_screen_locker: function () {
      return this.screen_locker;
    }

  });

  // Extend Chrome widget to add RFID controls using proper widget system
  var ChromeWidget = chrome.Chrome;
  chrome.Chrome = ChromeWidget.extend({

    build_widgets: function () {
      this._super();

      var self = this;
      if (self.pos && self.pos.config && self.pos.config.enable_rfid_auth) {
        setTimeout(function () {
          self.add_rfid_status();
        }, 500);
      }
    },

    /**
     * Add RFID status indicator
     */
    add_rfid_status: function () {
      if (this.pos.rfid_reader) {
        try {
          var $rfid_status = $(QWeb.render('RfidStatusIndicator', {}));

          // Add to the right header area near other status indicators
          if (this.$('.pos-rightheader .oe_status').length > 0) {
            this.$('.pos-rightheader .oe_status').last().after($rfid_status);
          } else if (this.$('.pos-rightheader').length > 0) {
            this.$('.pos-rightheader').append($rfid_status);
          } else {
            // Fallback to body with fixed positioning
            $('body').append($rfid_status.css({
              position: 'fixed',
              top: '10px',
              right: '150px',
              'z-index': '9999'
            }));
          }

          // Update status based on reader state
          this.pos.rfid_reader.on('device_connected', this, function () {
            $rfid_status.find('.status').text(_t('Listo'));
            $rfid_status.removeClass('disconnected').addClass('connected');
          });

          this.pos.rfid_reader.on('device_disconnected', this, function () {
            $rfid_status.find('.status').text(_t('Desconectado'));
            $rfid_status.removeClass('connected').addClass('disconnected');
          });

          // console.log('RFID status indicator added to header');
        } catch (error) {
          console.warn('Could not add RFID status indicator:', error);
        }
      }
    }

  });

  // Add keyboard shortcut for manual lock
  $(document).ready(function () {
    $(document).keydown(function (e) {
      // Ctrl+Alt+L to lock screen
      if (e.ctrlKey && e.altKey && e.keyCode === 76) {
        if (current_pos_instance && current_pos_instance.is_rfid_enabled && current_pos_instance.is_rfid_enabled()) {
          if (current_pos_instance.lock_screen) {
            current_pos_instance.lock_screen();
            // console.log('POS screen locked manually via Ctrl+Alt+L');
          }
        } else if (current_pos_instance) {
          // console.log('RFID authentication is not enabled for this POS');
        } else {
          // console.log('POS not initialized yet');
        }
        e.preventDefault();
      }
    });
  });

  // console.log('POS RFID Authentication module loaded');

  // Create global handler function for template onclick
  window.rfid_lock_screen_handler = function () {
    if (current_pos_instance && current_pos_instance.lock_screen) {
      try {
        current_pos_instance.lock_screen();
      } catch (error) {
        console.error('Error calling lock_screen:', error);
      }
    } else {
      console.error('No POS instance available for lock screen');
    }
  };

});