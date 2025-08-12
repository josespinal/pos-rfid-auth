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
      this.saved_popup_state = null; // Store popup state when forcing lock

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

      // Check if there are active popups before locking
      if (this.has_active_popups()) {
        if (this.should_respect_popups()) {
          // Respect popups - delay the lock
          // console.log('Delaying screen lock - active popup detected');
          this.schedule_delayed_lock();
          return;
        } else {
          // Don't respect popups - save state and force lock
          // console.log('Force locking with active popup - will save state for restoration');
          this.save_popup_state();
          // Continue with normal lock (popup will be closed by disable_pos_interactions)
        }
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

      // Restore any saved popup state after a brief delay
      var self = this;
      setTimeout(function () {
        self.restore_popup_state();
      }, 500); // Give UI time to stabilize

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
      // Close any remaining popups that might still be open
      this.force_close_popups();

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
      // For manual locking, we want to force lock immediately
      this.force_lock_immediate();
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
     * Check if configuration requires respecting active popups
     */
    should_respect_popups: function () {
      // Default to true if not configured
      return this.pos.config.rfid_respect_popups !== false;
    },

    /**
     * Check if there are active popups that should prevent locking
     */
    has_active_popups: function () {
      // List of popup selectors to check for
      var popup_selectors = [
        '.popup:visible', // Generic popup check
        '.side-dishes-popup:visible', // Side dishes popup
        '.modal:visible', // Bootstrap modals
        '.popup-textinput:visible', // Text input popups
        '.popup-number:visible', // Number input popups
        '.popup-selection:visible', // Selection popups
        '.popup-confirm:visible', // Confirmation popups
        '.popup-error:visible', // Error popups
        '.popup-payment:visible', // Payment popups
        '.packlotline-popup:visible', // Pack lot popups
        '.popup-edit-product:visible', // Product edit popups
        '.wizard:visible' // Any wizard dialogs
      ];

      // Check for any visible popups
      for (var i = 0; i < popup_selectors.length; i++) {
        if ($(popup_selectors[i]).length > 0) {
          // console.log('Active popup detected:', popup_selectors[i]);
          return true;
        }
      }

      // Check for active GUI popup (POS-specific)
      if (this.pos && this.pos.gui && this.pos.gui.current_popup) {
        // console.log('Active GUI popup detected:', this.pos.gui.current_popup);
        return true;
      }

      return false;
    },

    /**
     * Schedule a delayed lock attempt
     */
    schedule_delayed_lock: function () {
      var self = this;

      // Clear any existing delayed lock timer
      if (this.delayed_lock_timer) {
        clearTimeout(this.delayed_lock_timer);
      }

      // Schedule another lock attempt in 30 seconds
      this.delayed_lock_timer = setTimeout(function () {
        // console.log('Attempting delayed screen lock');
        self.lock_screen();
      }, 30000); // 30 seconds delay
    },

    /**
     * Force lock screen (ignores active popups - for manual locking)
     */
    force_lock_immediate: function () {
      // Close any active popups first
      this.close_active_popups();

      // Force lock regardless of popup state
      this.force_lock_internal();
    },

    /**
     * Internal force lock method
     */
    force_lock_internal: function () {
      var self = this;
      this.is_locked = true;

      // Create lock overlay
      this.create_lock_overlay();

      // Disable POS interactions
      this.disable_pos_interactions();

      // Clear timers
      if (this.inactivity_timer) {
        clearTimeout(this.inactivity_timer);
        this.inactivity_timer = null;
      }
      if (this.delayed_lock_timer) {
        clearTimeout(this.delayed_lock_timer);
        this.delayed_lock_timer = null;
      }

      // Trigger lock event
      this.trigger('screen_locked');

      // console.log('POS screen force locked');
    },

    /**
     * Close active popups gracefully and save state for restoration
     */
    close_active_popups: function () {
      // Save popup state before closing
      this.save_popup_state();

      this.force_close_popups();
    },

    /**
     * Force close all popups without saving state
     */
    force_close_popups: function () {
      // Close GUI popup if active
      if (this.pos && this.pos.gui && this.pos.gui.current_popup) {
        try {
          this.pos.gui.close_popup();
        } catch (e) {
          console.warn('Could not close GUI popup:', e);
        }
      }

      // Close any visible jQuery popups/modals
      $('.popup:visible, .modal:visible').each(function () {
        try {
          $(this).find('.button.cancel, .btn-close, .close').first().click();
        } catch (e) {
          console.warn('Could not close popup:', e);
        }
      });

      // Force hide any remaining visible popups
      $('.popup:visible, .modal:visible').hide();
    },

    /**
     * Save current popup state for potential restoration
     */
    save_popup_state: function () {
      var popup_state = null;

      // Check for side dishes popup specifically
      if ($('.side-dishes-popup:visible').length > 0) {
        popup_state = {
          type: 'side_dishes',
          orderline_id: null,
          product_id: null
        };

        // Try to get the current orderline being configured
        var current_order = this.pos.get_order();
        if (current_order) {
          var selected_line = current_order.get_selected_orderline();
          if (selected_line && selected_line.product) {
            popup_state.orderline_id = selected_line.cid; // Use client ID for tracking
            popup_state.product_id = selected_line.product.id;
            popup_state.product_name = selected_line.product.display_name;
          }
        }
      }
      // Could extend this for other popup types in the future
      else if (this.pos && this.pos.gui && this.pos.gui.current_popup) {
        popup_state = {
          type: 'generic',
          popup_name: this.pos.gui.current_popup.template || 'unknown'
        };
      }

      this.saved_popup_state = popup_state;

      if (popup_state) {
        console.log('Saved popup state for restoration:', popup_state);
      }
    },

    /**
     * Restore popup state after unlock if applicable
     */
    restore_popup_state: function () {
      if (!this.saved_popup_state) {
        return;
      }

      var popup_state = this.saved_popup_state;
      console.log('Attempting to restore popup state:', popup_state);

      if (popup_state.type === 'side_dishes') {
        this.restore_side_dishes_popup(popup_state);
      }
      // Could handle other popup types here

      // Clear saved state after restoration attempt
      this.saved_popup_state = null;
    },

    /**
     * Restore side dishes popup specifically
     */
    restore_side_dishes_popup: function (popup_state) {
      var self = this;

      // Show restoration prompt to user
      if (this.pos && this.pos.gui) {
        this.pos.gui.show_popup('confirm', {
          title: 'Side Dishes Selection Interrupted',
          body: 'Your side dish selection for "' + (popup_state.product_name || 'product') +
            '" was interrupted by screen lock.\n\nWould you like to continue selecting side dishes?',
          confirm: function () {
            // Find the orderline and reopen side dishes popup
            self.reopen_side_dishes_popup(popup_state);
          },
          cancel: function () {
            // User chose not to restore - remove the product that needs sides
            self.handle_incomplete_side_dish_product(popup_state);
          }
        });
      }
    },

    /**
     * Reopen side dishes popup for the interrupted product
     */
    reopen_side_dishes_popup: function (popup_state) {
      if (!this.pos || !popup_state.orderline_id) {
        return;
      }

      var current_order = this.pos.get_order();
      if (!current_order) {
        return;
      }

      // Find the orderline by client ID
      var target_line = null;
      var orderlines = current_order.get_orderlines();

      for (var i = 0; i < orderlines.length; i++) {
        if (orderlines[i].cid === popup_state.orderline_id) {
          target_line = orderlines[i];
          break;
        }
      }

      if (target_line) {
        // Select the line and trigger side dishes popup
        current_order.select_orderline(target_line);

        // Use a small delay to ensure the line is selected
        setTimeout(function () {
          if (target_line.has_side_groups && target_line.has_side_groups()) {
            // Trigger side dishes popup using the proper method
            if (this.pos.gui.show_popup) {
              this.pos.gui.show_popup('side_dishes_popup', {
                line: target_line,
                title: 'Select Side Dishes for ' + target_line.product.display_name
              });
            }
          }
        }.bind(this), 100);
      }
    },

    /**
     * Handle incomplete side dish product by removing it or offering alternatives
     */
    handle_incomplete_side_dish_product: function (popup_state) {
      if (!this.pos || !popup_state.orderline_id) {
        return;
      }

      var current_order = this.pos.get_order();
      if (!current_order) {
        return;
      }

      // Find and remove the incomplete orderline
      var target_line = null;
      var orderlines = current_order.get_orderlines();

      for (var i = 0; i < orderlines.length; i++) {
        if (orderlines[i].cid === popup_state.orderline_id) {
          target_line = orderlines[i];
          break;
        }
      }

      if (target_line) {
        // Check if this product requires side dishes
        var requires_sides = target_line.has_side_groups && target_line.has_side_groups() &&
          target_line.get_required_side_groups && target_line.get_required_side_groups().length > 0;

        if (requires_sides) {
          // Remove the product since it requires sides but user cancelled
          current_order.remove_orderline(target_line);

          // Show notification
          if (this.pos.gui && this.pos.gui.show_popup) {
            this.pos.gui.show_popup('error', {
              title: 'Product Removed',
              body: '"' + (popup_state.product_name || 'Product') + '" was removed from the order because it requires side dish selection.'
            });
          }
        }
        // If sides are optional, leave the product in the order
      }
    },

    /**
     * Destroy the screen locker
     */
    destroy: function () {
      // Clear timers
      if (this.inactivity_timer) {
        clearTimeout(this.inactivity_timer);
      }
      if (this.delayed_lock_timer) {
        clearTimeout(this.delayed_lock_timer);
      }

      // Remove overlay
      this.remove_lock_overlay();

      // Re-enable interactions
      this.enable_pos_interactions();
    }

  });

  return ScreenLocker;

}); 