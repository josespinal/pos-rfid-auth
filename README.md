# POS RFID Authentication

This module provides RFID card authentication functionality for Odoo 12 Point of Sale with advanced screen locking capabilities.

## Features

- 🔒 **Screen Locking**: Automatic and manual screen locking with inactivity timeout
- 📱 **RFID Authentication**: Support for HID RFID card readers
- 🔐 **PIN + RFID Combination**: Dual authentication for enhanced security
- ⌨️ **Keyboard Fallback**: Works with RFID readers that emulate keyboard input
- 🌐 **WebHID Support**: Direct communication with HID devices in supported browsers
- 👥 **User Management**: Individual RFID card assignment and authentication preferences
- 🎮 **Manual Controls**: Lock button and keyboard shortcuts for manual control

## Installation

1. Copy the `pos_rfid_auth` folder to your Odoo addons directory
2. Update your module list: Go to Apps > Update Apps List
3. Install the module: Search for "POS RFID Authentication" and click Install
4. Configure your POS settings and user RFID cards

## Configuration

### POS Configuration

Navigate to **Point of Sale > Configuration > Point of Sale** and edit your POS configuration:

1. **Enable RFID Authentication**: Check this option to activate RFID features
2. **Auto Lock Screen**: Enable automatic screen locking after inactivity
3. **Lock Timeout**: Set the inactivity timeout in minutes (default: 5 minutes)
4. **Always Require PIN**: Force PIN requirement even for RFID-only users

### User Configuration

Navigate to **Settings > Users & Companies > Users** and edit user profiles:

1. **RFID Card ID**: Enter or scan the RFID card identifier
2. **Require RFID for POS**: Enable RFID authentication for this user
3. **RFID + PIN Combination**: Require both RFID card and PIN for authentication

## Usage

### Authentication Methods

The module supports three authentication methods:

1. **RFID Only**: User scans their RFID card for instant access
2. **PIN Only**: User enters their security PIN
3. **RFID + PIN**: User must both scan RFID card AND enter PIN (recommended for high security)

### Screen Locking

- **Automatic**: Screen locks after the configured inactivity timeout
- **Manual**: Click the lock button in the POS header or use Ctrl+Alt+L
- **Unlock**: Scan RFID card or click unlock button to show authentication dialog

### RFID Reader Support

The module supports two types of RFID readers and **automatically defaults to keyboard input** for maximum compatibility:

#### Default: Keyboard Emulation Readers
**Recommended and automatic** - For RFID readers that act as keyboards:
- Any USB HID keyboard-emulating RFID reader
- Serial readers with keyboard wedge output
- Most consumer-grade RFID readers
- Works immediately without browser permissions

#### Optional: WebHID Compatible Readers
For direct USB HID communication (requires HTTPS, compatible browser, and user permission):
- AuthenTec devices (Vendor ID: 0x08FF)
- Realtek devices (Vendor ID: 0x0BDA)
- Dell devices (Vendor ID: 0x413C)
- Honeywell devices (Vendor ID: 0x0C2E)
- Generic HID readers (Vendor ID: 0x1234)

**Note**: WebHID requires explicit user permission and must be enabled manually if needed. The module works perfectly with keyboard input mode.

### Security Features

- **Duplicate Prevention**: Prevents duplicate card scans within 2 seconds
- **Interaction Blocking**: Completely disables POS interactions when locked
- **Keyboard Protection**: Blocks keyboard shortcuts (except F5 and dev tools)
- **Right-click Protection**: Disables context menus when locked
- **Session Persistence**: Maintains authentication state across browser refreshes

## Technical Details

### Browser Compatibility

| Feature        | Chrome/Edge | Firefox | Safari |
| -------------- | ----------- | ------- | ------ |
| Keyboard Input | ✅           | ✅       | ✅      |
| WebHID         | ✅           | ❌       | ❌      |
| Screen Lock    | ✅           | ✅       | ✅      |

**Note**: WebHID is only supported in Chromium-based browsers. Firefox and Safari will automatically fall back to keyboard input mode.

### RFID Card Formats

The module accepts various RFID card formats:
- Decimal numbers (e.g., "1234567890")
- Hexadecimal strings (e.g., "ABCDEF123456")
- ASCII strings (depends on reader configuration)
- Custom formats (automatically parsed from HID input)

### Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   RFID Reader   │────│ Screen Locker   │────│  Auth Popup     │
│                 │    │                 │    │                 │
│ - WebHID API    │    │ - Auto Lock     │    │ - PIN Input     │
│ - Keyboard Input│    │ - Manual Lock   │    │ - RFID Scanner  │
│ - Event Handler │    │ - Overlay UI    │    │ - Dual Auth     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   POS Model     │
                    │                 │
                    │ - User Auth     │
                    │ - Event Router  │
                    │ - State Manager │
                    └─────────────────┘
```

## Troubleshooting

### RFID Reader Issues

1. **Reader Not Working**: Ensure your RFID reader is in keyboard emulation mode (default)
2. **WebHID Security Error**: This is normal - the module automatically uses keyboard input
3. **No Browser Permissions Needed**: Keyboard input mode works without any permissions
4. **WebHID Optional**: Only enable WebHID if you specifically need direct HID communication
5. **HTTPS Required**: Only needed for WebHID mode (not for keyboard mode)

### Authentication Issues

1. **Card Not Recognized**: Verify RFID card ID is correctly entered in user profile
2. **PIN Required**: Check user settings for PIN combination requirements
3. **Access Denied**: Ensure user has "Require RFID for POS" enabled
4. **Multiple Users**: Each RFID card can only be assigned to one user

### Screen Lock Problems

1. **Auto-lock Not Working**: Check POS configuration for "Auto Lock Screen" setting
2. **Cannot Unlock**: Try refreshing the page or use the manual PIN entry
3. **Keyboard Blocked**: This is intentional - use RFID or PIN to unlock

### Performance Issues

1. **Slow Authentication**: Network latency during user lookup - check server performance
2. **Browser Lag**: Disable browser extensions that might interfere with HID access
3. **Memory Usage**: Module cleanup happens automatically - restart browser if needed

## Development and Testing

### Debug Mode

Enable debug mode in Odoo to access additional features:
- Test RFID button in authentication popup
- Extended console logging
- Development keyboard shortcuts

### Testing RFID

1. Use the "Test RFID" button in debug mode
2. Manually enter RFID card IDs in the authentication popup
3. Use keyboard input simulation for testing

### Customization

The module is designed to be extensible:

```javascript
// Access RFID reader instance
var rfidReader = pos.get_rfid_reader();

// Listen for card scans
rfidReader.on('card_scanned', this, function(event) {
    console.log('Card scanned:', event.card_id);
});

// Manual screen lock
pos.lock_screen();

// Check lock status
if (pos.get_screen_locker().is_screen_locked()) {
    console.log('Screen is locked');
}
```

## Support

For issues and questions:
1. Check the Odoo log files for error messages
2. Enable browser developer tools to see console output
3. Verify RFID reader compatibility with your hardware
4. Test with different browsers if WebHID issues occur

## License

This module is licensed under the same license as Odoo 12.

## Changelog

### Version 1.0.0
- Initial release
- WebHID and keyboard input support
- Screen locking functionality
- PIN + RFID authentication
- User management integration
- Multi-browser compatibility 