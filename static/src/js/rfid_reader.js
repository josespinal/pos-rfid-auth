odoo.define('pos_rfid_auth.rfid_reader', function (require) {
  "use strict";

  var core = require('web.core');
  var Class = core.Class;
  var mixins = require('web.mixins');

  /**
   * RFID Reader for HID devices
   * Handles communication with USB HID RFID readers
   */
  var RfidReader = Class.extend(mixins.EventDispatcherMixin, {

    init: function (pos) {
      mixins.EventDispatcherMixin.init.call(this);
      this.pos = pos;
      this.device = null;
      this.is_connected = false;
      this.last_card_id = null;
      this.last_scan_time = 0;
      this.scan_cooldown = 2000; // 2 seconds cooldown between scans
      this.input_buffer = '';
      this.scan_timeout = null;

      // Initialize RFID reader
      this.initialize();
    },

    /**
     * Initialize the RFID reader
     */
    initialize: function () {
      var self = this;

      // Check if WebHID is supported
      if ('hid' in navigator) {
        this.setup_webhid();
      } else {
        // Fallback to keyboard input method
        this.setup_keyboard_input();
      }
    },

    /**
     * Setup WebHID for direct HID device communication
     */
    setup_webhid: function () {
      var self = this;

      // Request HID device access
      this.request_device().then(function (device) {
        if (device) {
          self.connect_device(device);
        } else {
          // Fallback to keyboard input
          self.setup_keyboard_input();
        }
      }).catch(function (error) {
        console.warn('WebHID not available, using keyboard input fallback', error);
        self.setup_keyboard_input();
      });
    },

    /**
     * Request access to HID device
     */
    request_device: function () {
      return navigator.hid.requestDevice({
        filters: [
          // Common RFID reader vendor IDs
          { vendorId: 0x08FF }, // AuthenTec
          { vendorId: 0x0BDA }, // Realtek
          { vendorId: 0x1234 }, // Generic HID reader
          { vendorId: 0x413C }, // Dell
          { vendorId: 0x0C2E }, // Honeywell
        ]
      }).then(function (devices) {
        return devices.length > 0 ? devices[0] : null;
      });
    },

    /**
     * Connect to HID device
     */
    connect_device: function (device) {
      var self = this;

      this.device = device;

      device.open().then(function () {
        self.is_connected = true;
        self.trigger('device_connected');

        // Listen for input reports
        device.addEventListener('inputreport', function (event) {
          self.handle_hid_input(event);
        });

        // console.log('RFID Reader connected via WebHID');
      }).catch(function (error) {
        console.error('Failed to connect to RFID device:', error);
        self.setup_keyboard_input();
      });
    },

    /**
     * Handle HID input reports
     */
    handle_hid_input: function (event) {
      var data = new Uint8Array(event.data.buffer);
      var card_id = this.parse_rfid_data(data);

      if (card_id) {
        this.process_card_scan(card_id);
      }
    },

    /**
     * Parse RFID data from HID input
     */
    parse_rfid_data: function (data) {
      // Convert bytes to string (this may need adjustment based on your specific RFID reader)
      var card_id = '';

      for (var i = 0; i < data.length; i++) {
        if (data[i] > 0 && data[i] < 127) { // ASCII range
          card_id += String.fromCharCode(data[i]);
        }
      }

      // Clean up the card ID (remove whitespace, newlines, etc.)
      card_id = card_id.trim().replace(/[\r\n]/g, '');

      return card_id.length > 0 ? card_id : null;
    },

    /**
     * Setup keyboard input as fallback for RFID readers that act as keyboards
     */
    setup_keyboard_input: function () {
      var self = this;

      // Listen for keydown events globally
      document.addEventListener('keydown', function (event) {
        self.handle_keyboard_input(event);
      });

      this.is_connected = true;
      this.trigger('device_connected');
      // console.log('RFID Reader initialized with keyboard input fallback');
    },

    /**
     * Handle keyboard input for RFID cards
     */
    handle_keyboard_input: function (event) {
      var self = this;

      // Only process if no input field is focused and we're waiting for RFID
      if (this.should_process_keyboard_input()) {

        // Clear existing timeout
        if (this.scan_timeout) {
          clearTimeout(this.scan_timeout);
        }

        if (event.key === 'Enter') {
          // Process the buffered input as RFID card
          if (this.input_buffer.length > 0) {
            this.process_card_scan(this.input_buffer);
            this.input_buffer = '';
          }
        } else if (event.key.length === 1) {
          // Add character to buffer
          this.input_buffer += event.key;

          // Set timeout to clear buffer if no Enter is received
          this.scan_timeout = setTimeout(function () {
            self.input_buffer = '';
          }, 1000);
        }
      }
    },

    /**
     * Check if we should process keyboard input as RFID
     */
    should_process_keyboard_input: function () {
      // Don't process if any input field is focused
      var active_element = document.activeElement;
      if (active_element && (
        active_element.tagName === 'INPUT' ||
        active_element.tagName === 'TEXTAREA' ||
        active_element.isContentEditable
      )) {
        return false;
      }

      // Only process if authentication popup is visible or screen is locked
      var auth_popup = document.querySelector('.rfid-auth-popup');
      var screen_lock = document.querySelector('.screen-lock-overlay');

      return auth_popup || screen_lock;
    },

    /**
     * Process scanned card
     */
    process_card_scan: function (card_id) {
      var current_time = Date.now();

      // Prevent duplicate scans
      if (card_id === this.last_card_id &&
        (current_time - this.last_scan_time) < this.scan_cooldown) {
        return;
      }

      this.last_card_id = card_id;
      this.last_scan_time = current_time;

      // Trigger card scanned event
      this.trigger('card_scanned', {
        card_id: card_id,
        timestamp: current_time
      });

      // console.log('RFID Card scanned:', card_id);
    },

    /**
     * Disconnect the device
     */
    disconnect: function () {
      if (this.device && this.is_connected) {
        this.device.close();
      }
      this.is_connected = false;
      this.trigger('device_disconnected');
    },

    /**
     * Get connection status
     */
    is_device_connected: function () {
      return this.is_connected;
    },

    /**
     * Test RFID reader (simulate a card scan)
     */
    test_scan: function () {
      var test_card_id = 'TEST_CARD_' + Date.now();
      this.process_card_scan(test_card_id);
    }

  });

  return RfidReader;

}); 