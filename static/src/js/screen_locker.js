odoo.define('pos_rfid_auth.screen_locker', function (require) {
  "use strict";

  var core = require('web.core');
  var Class = core.Class;
  var mixins = require('web.mixins');
  var QWeb = core.qweb;

  /**
   * Screen Locker for POS
   * Handles automatic screen locking and manual lock/unlock
   */
  var ScreenLocker = Class.extend(mixins.EventDispatcherMixin, {

    init: function (pos) {
      mixins.EventDispatcherMixin.init.call(this);
      this.pos = pos;
      this.is_locked = false;
      this.lock_overlay = null;
      this.inactivity_timer = null;
      this.lock_timeout = 5 * 60 * 1000; // Default 5 minutes
      this.last_activity = Date.now();

      this.setup_inactivity_tracking();
    },

    /**
     * Setup inactivity tracking
     */
    setup_inactivity_tracking: function () {
      var self = this;

      // Update lock timeout from POS config
      if (this.pos.config.rfid_lock_timeout) {
        this.lock_timeout = this.pos.config.rfid_lock_timeout * 60 * 1000;
      }

      // Track user activity
      var activity_events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

      activity_events.forEach(function (event) {
        document.addEventListener(event, function () {
          self.update_activity();
        }, true);
      });

      // Start inactivity timer if auto-lock is enabled
      if (this.pos.config.rfid_auto_lock) {
        this.start_inactivity_timer();
      }
    },

    /**
     * Update last activity timestamp
     */
    update_activity: function () {
      this.last_activity = Date.now();

      // Reset inactivity timer if not locked
      if (!this.is_locked && this.pos.config.rfid_auto_lock) {
        this.start_inactivity_timer();
      }
    },

    /**
     * Start inactivity timer
     */
    start_inactivity_timer: function () {
      var self = this;

      // Clear existing timer
      if (this.inactivity_timer) {
        clearTimeout(this.inactivity_timer);
      }

      // Set new timer
      this.inactivity_timer = setTimeout(function () {
        self.lock_screen();
      }, this.lock_timeout);
    },

    /**
     * Lock the screen
     */
    lock_screen: function () {
      if (this.is_locked) {
        return;
      }

      var self = this;
      this.is_locked = true;

      // Create lock overlay
      this.create_lock_overlay();

      // Disable POS interactions
      this.disable_pos_interactions();

      // Clear inactivity timer
      if (this.inactivity_timer) {
        clearTimeout(this.inactivity_timer);
        this.inactivity_timer = null;
      }

      // Trigger lock event
      this.trigger('screen_locked');

      // console.log('POS screen locked');
    },

    /**
     * Unlock the screen
     */
    unlock_screen: function () {
      if (!this.is_locked) {
        return;
      }

      this.is_locked = false;

      // Remove lock overlay
      this.remove_lock_overlay();

      // Enable POS interactions
      this.enable_pos_interactions();

      // Restart inactivity timer if auto-lock is enabled
      if (this.pos.config.rfid_auto_lock) {
        this.start_inactivity_timer();
      }

      // Update activity timestamp
      this.update_activity();

      // Trigger unlock event
      this.trigger('screen_unlocked');

      // console.log('POS screen unlocked');
    },

    /**
     * Create lock overlay
     */
    create_lock_overlay: function () {
      var self = this;

      // Create overlay element
      this.lock_overlay = $(QWeb.render('ScreenLockOverlay', {}));

      // Add event handlers
      this.lock_overlay.find('.unlock-btn').click(function () {
        self.show_authentication();
      });

      // Prevent default actions on the overlay
      this.lock_overlay.on('contextmenu', function (e) {
        e.preventDefault();
        return false;
      });

      // Add to DOM
      $('body').append(this.lock_overlay);

      // Animate in
      setTimeout(function () {
        self.lock_overlay.addClass('visible');
      }, 10);
    },

    /**
 * Remove lock overlay
 */
    remove_lock_overlay: function () {
      if (this.lock_overlay) {
        this.lock_overlay.remove();
        this.lock_overlay = null;
      }
    },

    /**
     * Restore lock overlay z-index (called when authentication popup closes without unlocking)
     */
    restore_lock_overlay_z_index: function () {
      if (this.lock_overlay) {
        this.lock_overlay.css({
          'z-index': '9999',
          'pointer-events': 'auto'  // Restore pointer events
        });
      }
    },

    /**
 * Show authentication dialog
 */
    show_authentication: function () {
      // Temporarily lower the z-index of lock overlay to allow popup to show on top
      if (this.lock_overlay) {
        this.lock_overlay.css({
          'z-index': '9000',
          'pointer-events': 'none'  // Allow clicks through the overlay
        });
      }
      this.trigger('authentication_requested');
    },

    /**
     * Disable POS interactions
     */
    disable_pos_interactions: function () {
      // Add CSS class to disable interactions
      $('.pos').addClass('pos-locked');

      // Disable keyboard shortcuts
      $(document).on('keydown.pos-lock', function (e) {
        // Only allow F5 (refresh) and Ctrl+Shift+I (dev tools)
        if (e.key === 'F5' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
          return true;
        }

        // Allow keyboard input in authentication popup
        var target = $(e.target);
        if (target.closest('.popup-rfid-auth').length > 0 ||
          target.closest('.rfid-auth-popup').length > 0 ||
          target.hasClass('pin-input') ||
          target.closest('.pin-input').length > 0) {
          return true; // Allow keyboard events for authentication popup
        }

        e.preventDefault();
        e.stopPropagation();
        return false;
      });

      // Disable mouse clicks outside authentication popup
      $(document).on('click.pos-lock mousedown.pos-lock mouseup.pos-lock', function (e) {
        var target = $(e.target);

        // Allow clicks on authentication popup and its contents
        if (target.closest('.popup-rfid-auth').length > 0 ||
          target.closest('.rfid-auth-popup').length > 0 ||
          target.closest('.modal-dialog.rfid-auth-popup').length > 0) {
          return true; // Allow mouse events for authentication popup
        }

        // Allow clicks on screen lock overlay unlock button
        if (target.closest('.unlock-btn').length > 0 ||
          target.closest('.screen-lock-overlay').length > 0) {
          return true;
        }

        e.preventDefault();
        e.stopPropagation();
        return false;
      });

      // Disable right-click except for authentication popup
      $(document).on('contextmenu.pos-lock', function (e) {
        var target = $(e.target);

        // Allow right-click in authentication popup
        if (target.closest('.popup-rfid-auth').length > 0 ||
          target.closest('.rfid-auth-popup').length > 0 ||
          target.closest('.modal-dialog.rfid-auth-popup').length > 0) {
          return true;
        }

        e.preventDefault();
        return false;
      });
    },

    /**
     * Enable POS interactions
     */
    enable_pos_interactions: function () {
      // Remove CSS class
      $('.pos').removeClass('pos-locked');

      // Re-enable keyboard and mouse events
      $(document).off('keydown.pos-lock');
      $(document).off('click.pos-lock mousedown.pos-lock mouseup.pos-lock');
      $(document).off('contextmenu.pos-lock');
    },

    /**
     * Check if screen is locked
     */
    is_screen_locked: function () {
      return this.is_locked;
    },

    /**
     * Force lock screen (for manual locking)
     */
    force_lock: function () {
      this.lock_screen();
    },

    /**
     * Force unlock screen (after successful authentication)
     */
    force_unlock: function () {
      this.unlock_screen();
    },

    /**
     * Update lock timeout
     */
    update_lock_timeout: function (timeout_minutes) {
      this.lock_timeout = timeout_minutes * 60 * 1000;

      // Restart timer with new timeout
      if (!this.is_locked && this.pos.config.rfid_auto_lock) {
        this.start_inactivity_timer();
      }
    },

    /**
     * Destroy the screen locker
     */
    destroy: function () {
      // Clear timer
      if (this.inactivity_timer) {
        clearTimeout(this.inactivity_timer);
      }

      // Remove overlay
      this.remove_lock_overlay();

      // Re-enable interactions
      this.enable_pos_interactions();
    }

  });

  return ScreenLocker;

}); 