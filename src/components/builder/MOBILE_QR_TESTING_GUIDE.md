# Mobile QR Code Testing Guide

## Overview

This guide provides instructions for testing the QR code functionality on actual mobile devices to verify Requirements 12.3 and 12.4.

## Prerequisites

- A mobile device (iOS or Android)
- QR code scanner app (most modern phones have this built into the camera app)
- The AI Builder IDE running locally or on a network-accessible URL
- Both the development machine and mobile device on the same network (for local testing)

## Testing Checklist

### 1. QR Code Scanning (Requirement 12.3)

#### iOS Testing
- [ ] Open the Camera app on iPhone/iPad
- [ ] Point the camera at the QR code displayed in the AI Builder IDE
- [ ] Verify that a notification appears at the top of the screen
- [ ] Tap the notification to open the preview URL
- [ ] Verify the preview loads correctly in Safari
- [ ] Test with iOS 15+ and iOS 16+ if possible

#### Android Testing
- [ ] Open the Camera app or Google Lens on Android device
- [ ] Point the camera at the QR code displayed in the AI Builder IDE
- [ ] Verify that the QR code is recognized
- [ ] Tap to open the preview URL
- [ ] Verify the preview loads correctly in Chrome/default browser
- [ ] Test with Android 11+ and Android 12+ if possible

### 2. Preview Loading (Requirement 12.3)

- [ ] Verify the preview loads within 5 seconds
- [ ] Check that all UI elements render correctly on mobile
- [ ] Test responsive design at different screen sizes
- [ ] Verify touch interactions work properly
- [ ] Check that images and assets load correctly
- [ ] Test scrolling behavior
- [ ] Verify no console errors in mobile browser (use remote debugging)

### 3. Real-Time Updates (Requirement 12.4)

#### Setup
1. Open the AI Builder IDE on your desktop
2. Scan the QR code with your mobile device
3. Keep both the desktop and mobile browser open

#### Test Cases
- [ ] **File Edit Test**: Edit a file in the Monaco editor on desktop
  - Expected: Changes should appear on mobile within 2-3 seconds
  - Verify: HMR (Hot Module Replacement) works on mobile

- [ ] **Style Change Test**: Modify CSS/styling in the code
  - Expected: Style updates should reflect on mobile immediately
  - Verify: No full page reload required

- [ ] **Component Update Test**: Add or modify a React component
  - Expected: Component changes should appear on mobile
  - Verify: Application state is preserved during update

- [ ] **Error Recovery Test**: Introduce a syntax error, then fix it
  - Expected: Error should appear on mobile, then clear when fixed
  - Verify: Error overlay displays correctly on mobile

- [ ] **Asset Addition Test**: Add a new image or asset
  - Expected: New asset should load on mobile preview
  - Verify: Asset generation works for mobile preview

### 4. Network Conditions Testing

- [ ] Test on WiFi connection
- [ ] Test on 4G/5G mobile data (if applicable)
- [ ] Test with slow network (throttle connection)
- [ ] Verify loading indicators appear during slow loads
- [ ] Test reconnection after network interruption

### 5. Cross-Browser Testing (Mobile)

- [ ] Safari (iOS)
- [ ] Chrome (iOS)
- [ ] Chrome (Android)
- [ ] Firefox (Android)
- [ ] Samsung Internet (Android, if available)

### 6. QR Code Quality Testing

- [ ] Test QR code scanning from different distances (6 inches to 2 feet)
- [ ] Test in different lighting conditions (bright, dim, outdoor)
- [ ] Test with different screen brightness levels
- [ ] Verify QR code remains scannable when window is resized
- [ ] Test QR code on different display sizes (laptop, desktop monitor)

### 7. Copy URL Functionality

- [ ] Click "Copy URL" button in QR code modal
- [ ] Verify success toast appears
- [ ] Paste URL in mobile browser manually
- [ ] Verify pasted URL matches the QR code URL
- [ ] Verify preview loads from manually entered URL

## Known Limitations

1. **Local Development**: When running on localhost, mobile devices must be on the same network
2. **HTTPS**: Some features may require HTTPS for mobile browsers
3. **WebContainer**: Sandpack's WebContainer may have limitations on mobile browsers
4. **Network Latency**: Real-time updates depend on network speed

## Troubleshooting

### QR Code Won't Scan
- Ensure QR code is fully visible on screen
- Increase screen brightness
- Try a different QR code scanner app
- Verify the QR code is not corrupted (check console for errors)

### Preview Won't Load
- Check that both devices are on the same network
- Verify firewall settings allow connections
- Check browser console for errors
- Try accessing the URL directly (without QR code)

### Real-Time Updates Not Working
- Verify HMR is enabled in Sandpack configuration
- Check network connection stability
- Look for WebSocket connection errors in console
- Try refreshing the mobile browser

### Performance Issues
- Check mobile device specifications
- Verify network speed
- Monitor memory usage in browser dev tools
- Consider simplifying the preview content for testing

## Remote Debugging

### iOS Safari
1. Enable Web Inspector on iOS: Settings > Safari > Advanced > Web Inspector
2. Connect device to Mac via USB
3. Open Safari on Mac > Develop > [Your Device] > [Page]

### Android Chrome
1. Enable USB debugging on Android device
2. Connect device to computer via USB
3. Open Chrome on computer: chrome://inspect
4. Click "Inspect" next to your device

## Test Results Template

```
Date: ___________
Tester: ___________

Device Information:
- Device Model: ___________
- OS Version: ___________
- Browser: ___________

Test Results:
- QR Code Scanning: ☐ Pass ☐ Fail
- Preview Loading: ☐ Pass ☐ Fail
- Real-Time Updates: ☐ Pass ☐ Fail
- Copy URL: ☐ Pass ☐ Fail

Notes:
___________________________________________
___________________________________________
___________________________________________

Issues Found:
___________________________________________
___________________________________________
___________________________________________
```

## Success Criteria

All tests must pass for the following to be considered successful:

1. ✅ QR code scans successfully on both iOS and Android
2. ✅ Preview loads correctly on mobile browsers
3. ✅ Real-time updates work within 3 seconds
4. ✅ Copy URL functionality works correctly
5. ✅ No critical errors in mobile browser console
6. ✅ Responsive design works on various screen sizes

## Next Steps

After completing manual testing:
1. Document any issues found
2. Create bug reports for failures
3. Update the implementation if needed
4. Re-test after fixes
5. Mark task 14.4 as complete in tasks.md

## Additional Resources

- [Sandpack Documentation](https://sandpack.codesandbox.io/)
- [QRCode.react Documentation](https://github.com/zpao/qrcode.react)
- [Mobile Web Testing Best Practices](https://developer.mozilla.org/en-US/docs/Learn/Tools_and_testing/Cross_browser_testing/Testing_strategies)
