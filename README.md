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
- 🏷️ **RFID-Only Mode**: Option to hide PIN input and show only RFID authentication

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
4. **Always Require PIN**: Force PIN entry even for RFID-only users
5. **RFID-Only Mode**: Hide PIN input field and show only RFID authentication

### User Configuration

Navigate to **Settings > Users & Companies > Users** and edit each user:

1. **RFID Card ID**: Enter the unique ID of the user's RFID card
2. **Require RFID**: Force this user to authenticate with RFID
3. **RFID + PIN Combination**: Require both RFID card and PIN for this user

## RFID Reader Setup

### Supported Devices

- **HID-compatible RFID readers**: Most USB RFID readers that present as HID devices
- **Keyboard emulation readers**: RFID readers that send data as keyboard input
- **WebHID compatible devices**: For direct browser communication (requires user gesture)

### Connection Methods

#### 1. Keyboard Input Mode (Default)
- Works with most RFID readers out of the box
- Readers send card data as simulated keyboard input
- No special browser permissions required
- Automatically activated on module initialization

#### 2. WebHID Mode (Optional)
- Direct communication with HID devices
- Requires user gesture to enable (security requirement)
- More reliable for specific hardware
- Must be explicitly enabled by user action

**Important**: WebHID requires user interaction to request device permissions. The module defaults to keyboard input mode to avoid security errors.

### Device Configuration

1. Connect your RFID reader via USB
2. Ensure the reader is recognized by your operating system
3. For WebHID mode, the user must click an "Enable WebHID" button (if implemented)
4. Test by scanning a card - you should see input in the authentication popup

## Security Features

### Screen Locking

- **Automatic Locking**: Based on configurable inactivity timeout
- **Manual Locking**: 
  - Lock button in POS header
  - Keyboard shortcut: `Ctrl+Alt+L`
- **Lock on Startup**: Screen automatically locks when POS starts

### Authentication Methods

#### 1. RFID Only (`rfid_only_mode` enabled)
- Only RFID card scanning is shown
- PIN input field is hidden
- Ideal for environments where only RFID authentication is desired

#### 2. PIN Only
- Only PIN input is available
- RFID section is hidden
- Traditional authentication method

#### 3. Combined (Default)
- Both RFID and PIN options available
- User can choose preferred method
- Enhanced security for dual authentication

#### 4. RFID + PIN Combination
- Requires both RFID card AND PIN
- Maximum security level
- Configured per user

### User Authentication Flows

1. **Screen Unlock**: When screen is locked, show authentication popup
2. **User Switching**: Change active cashier without unlocking screen
3. **Security Validation**: Verify user permissions and authentication method

## Usage

### Basic Operations

1. **Start POS**: Screen locks automatically on startup
2. **Unlock Screen**: Scan RFID card or enter PIN in popup
3. **Lock Screen**: Click lock button or use `Ctrl+Alt+L`
4. **Switch Users**: Scan different user's RFID card when unlocked

### RFID Card Management

1. **Register Cards**: Assign unique card IDs to users in user settings
2. **Test Authentication**: Use the authentication popup to verify cards work
3. **Update Cards**: Change card IDs in user settings as needed

### Troubleshooting

#### Common Issues

1. **RFID Reader Not Working**
   - Check USB connection
   - Verify reader is HID-compatible
   - Try keyboard input mode
   - Check browser console for errors

2. **Authentication Fails**
   - Verify card ID matches user setting exactly
   - Check user has proper POS permissions
   - Ensure card ID is unique across users

3. **WebHID Errors**
   - WebHID requires user gesture to activate
   - Use keyboard input mode as fallback
   - Check browser compatibility

4. **Screen Won't Lock/Unlock**
   - Check module is enabled in POS config
   - Verify user permissions
   - Look for JavaScript errors in console

#### Debug Mode

Enable debug mode in Odoo to access additional features:

1. Navigate to `Settings > Activate Developer Mode`
2. Check browser console for detailed logging
3. Use the popup's test features (if enabled)

## Browser Compatibility

### WebHID Support
- **Chrome/Edge**: Full support
- **Firefox**: Limited support
- **Safari**: No support
- **Mobile browsers**: Generally no support

### Keyboard Input Support
- **All modern browsers**: Full support
- **Mobile devices**: Limited (depends on reader)

## Technical Details

### Architecture

- **Frontend**: JavaScript widgets and popups for POS interface
- **Backend**: Python models for user authentication and card management
- **Templates**: QWeb templates for UI components
- **Events**: Real-time event handling for RFID scans and screen locking

### File Structure

```
pos_rfid_auth/
├── models/
│   ├── pos_config.py          # POS configuration fields
│   └── res_users.py           # User RFID fields and authentication
├── static/src/
│   ├── js/
│   │   ├── pos_rfid_auth.js       # Main POS integration
│   │   ├── rfid_auth_popup.js     # Authentication popup
│   │   ├── rfid_reader.js         # RFID reader interface
│   │   └── screen_locker.js       # Screen locking logic
│   ├── xml/
│   │   └── pos_rfid_auth.xml      # QWeb templates
│   └── css/
│       └── pos_rfid_auth.css      # Styling
├── views/
│   ├── pos_config_views.xml       # Configuration interface
│   ├── res_users_views.xml        # User RFID settings
│   └── templates.xml              # Asset loading
└── __manifest__.py                # Module definition
```

### Dependencies

- `point_of_sale`: Core POS functionality
- `web`: Basic web framework
- Modern browser with JavaScript support

## License

This module is provided under the LGPL-3 license. See LICENSE file for details.