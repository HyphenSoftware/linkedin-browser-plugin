# Testing Guide for LinkedIn Profile Extraction Fix

This guide helps you test the fixes implemented to work around LinkedIn's deprecated `profileView` endpoint.

## Prerequisites

Before testing:
1. You must be logged into LinkedIn
2. Navigate to a LinkedIn profile page (your own or someone else's)
3. Have the updated browser extension installed (or side-loaded)

## Test Plan

### Test 1: Basic Functionality Test

**Objective**: Verify the extension can extract profile data

**Steps**:
1. Navigate to your LinkedIn profile: `https://www.linkedin.com/in/your-username/`
2. Click the browser extension icon
3. Click "LinkedIn Profile to JSON"
4. Verify a modal appears with JSON data

**Expected Result**: ✅ Profile data extracted successfully with no errors

**If it fails**:
- Open browser console (F12)
- Look for error messages
- Run diagnostic: `await LinkedInDiagnostic.runFullDiagnostic()`

---

### Test 2: Data Completeness Test

**Objective**: Verify all profile sections are extracted

**Steps**:
1. Export your profile to JSON
2. Check the JSON contains all expected sections:
   ```json
   {
     "basics": { ... },      // Name, headline, location
     "work": [ ... ],        // Work history
     "education": [ ... ],   // Education history
     "skills": [ ... ],      // Skills list
     "languages": [ ... ],   // Languages
     "certificates": [ ... ],// Certifications
     "volunteer": [ ... ],   // Volunteer experience
     "awards": [ ... ],      // Awards
     "publications": [ ... ] // Publications
   }
   ```

**Expected Result**: ✅ All sections that exist on your profile are in the JSON

**If sections are missing**:
- Check if those sections exist on your profile
- Enable debug mode: Add `?li2jr_debug=true` to URL
- Check console for section-specific errors

---

### Test 3: Endpoint Fallback Test

**Objective**: Verify the extension tries multiple endpoints

**Steps**:
1. Navigate to a profile page
2. Open browser console (F12)
3. Append `?li2jr_debug=true` to the URL and refresh
4. Run the extension
5. Watch console messages

**Expected Result**: ✅ Console shows:
```
Attempting to fetch profile via Dash endpoint...
Starting profile extraction...
API parse succeeded
```

**If Dash endpoint fails**: Should see fallback messages:
```
Dash endpoint failed, trying legacy profileView as fallback...
Attempting embedded schema extraction as fallback...
```

---

### Test 4: Error Handling Test

**Objective**: Verify 410 errors are handled gracefully

**Steps**:
1. Open browser console (F12)
2. Navigate to a profile
3. Run this command to force a 410 scenario:
   ```javascript
   // This should show a 410 warning but not break the extension
   await fetch('https://www.linkedin.com/voyager/api/identity/profiles/SOME_ID/profileView', {
       headers: {
           'csrf-token': document.cookie.match(/JSESSIONID="(.+?)"/)?.[1],
           'accept': 'application/vnd.linkedin.normalized+json+2.1'
       }
   }).then(r => console.log('Status:', r.status));
   ```

**Expected Result**: ✅ Shows warning about deprecated endpoint but doesn't crash

---

### Test 5: Multiple Profile Types

**Objective**: Verify extraction works on different profile types

**Test profiles**:
1. ✅ **Your own profile** (full access)
2. ✅ **1st connection profile** (more data visible)
3. ✅ **3rd connection profile** (limited data)
4. ✅ **Profile with multilingual versions** (if available)

**For each profile**:
- Run the extension
- Verify extraction completes without errors
- Check that visible data is captured

---

### Test 6: Diagnostic Tool Test

**Objective**: Verify the diagnostic tool works correctly

**Steps**:
1. Navigate to a profile
2. Open console (F12)
3. Copy contents of `src/diagnostic.js` and paste into console
4. Run: `await LinkedInDiagnostic.runFullDiagnostic()`
5. Review the output

**Expected Result**: ✅ Diagnostic shows:
```
=== SUMMARY ===
Working API Endpoints (4):
  ✓ dashFullProfile
  ✓ profileContactInfo
  ✓ profileSkills
  ✓ recommendations

Broken API Endpoints (1):
  ✗ profileView (OLD)

Available DOM Methods (2):
  ✓ Embedded JSON Schema
  ✓ Profile Picture

=== RECOMMENDATIONS ===
✓ RECOMMENDED: Use dashFullProfile endpoint as primary data source
```

---

### Test 7: Download Functionality

**Objective**: Verify JSON download works

**Steps**:
1. Navigate to your profile
2. Click extension icon
3. Click "Download JSON Resume Export"
4. Check Downloads folder

**Expected Result**: ✅ File downloads with name like `Your_Name.resume.json`

---

### Test 8: API Endpoint Test (If configured)

**Objective**: Verify sending to API works

**Prerequisites**: Signed in to the selected environment (*Sign in* button in the popup)

**Steps**:
1. Navigate to a profile
2. Open extension popup
3. Select an environment from the dropdown
4. Click "Add as Subcontractor" or "Add as Contact"
5. Check for success/error message

**Expected Result**: ✅ Profile data sent successfully to your API

---

## Performance Tests

### Test 9: Speed Test

**Objective**: Verify extraction completes in reasonable time

**Steps**:
1. Navigate to a profile with lots of data (many jobs, skills, etc.)
2. Note start time
3. Run extraction
4. Note completion time

**Expected Result**: ✅ Completes in under 10 seconds

---

### Test 10: Large Profile Test

**Objective**: Handle profiles with extensive work history

**Steps**:
1. Find a profile with 10+ work positions
2. Run extraction
3. Verify all positions are captured
4. Check for truncation warnings in console

**Expected Result**: ✅ All positions extracted or warning shown if truncated

---

## Edge Cases

### Test 11: No Data Sections

**Objective**: Handle profiles missing common sections

**Steps**:
1. Find a minimal profile (new user, limited info)
2. Run extraction
3. Check JSON

**Expected Result**: ✅ Empty arrays for missing sections, no errors

---

### Test 12: Special Characters

**Objective**: Handle profiles with special characters in names/descriptions

**Steps**:
1. Test on profile with:
   - Unicode characters (émojis, ñames, etc.)
   - Special symbols in job descriptions
   - URLs in summary
2. Run extraction
3. Verify JSON is valid

**Expected Result**: ✅ Characters encoded properly, valid JSON

---

### Test 13: Network Issues

**Objective**: Handle rate limiting or network errors

**Steps**:
1. Open Network tab in DevTools
2. Set throttling to "Slow 3G"
3. Try extraction

**Expected Result**: ✅ Either completes slowly or shows helpful error

---

## Regression Tests

### Test 14: Multilingual Profile

**Objective**: Ensure multilingual support still works

**Prerequisites**: Profile with multiple languages configured

**Steps**:
1. Navigate to a multilingual profile
2. Open extension popup
3. Check language dropdown
4. Select different language
5. Export profile
6. Verify data is in selected language

**Expected Result**: ✅ Language selection works, data in correct language

---

### Test 15: Profile Picture Extraction

**Objective**: Verify profile picture still extracts

**Steps**:
1. Navigate to profile with picture
2. Run extraction with debug mode
3. Check console for "Profile picture found" message
4. Verify JSON has `basics.image` or `basics.picture` field

**Expected Result**: ✅ Profile picture URL captured

---

## Test Matrix

| Test | Your Profile | 1st Connection | 3rd Connection | Expected |
|------|-------------|----------------|----------------|----------|
| Basic Export | ☐ | ☐ | ☐ | ✅ All pass |
| Work History | ☐ | ☐ | ☐ | ✅ All pass |
| Education | ☐ | ☐ | ☐ | ✅ All pass |
| Skills | ☐ | ☐ | ☐ | ✅ Most pass (privacy dependent) |
| Contact Info | ☐ | ☐ | ☐ | ✅ Varies by privacy |

---

## Reporting Test Results

If you find issues:

### 1. Gather Information
- Browser and version
- Profile type (own/1st/3rd connection)
- Error messages from console
- Diagnostic tool output

### 2. Save Diagnostic Results
```javascript
const results = await LinkedInDiagnostic.runFullDiagnostic();
console.log(JSON.stringify(results, null, 2));
// Copy this output
```

### 3. Create Test Report
```
Test Failed: [Test Name]
Browser: [Chrome 120 / Firefox 121 / etc.]
Profile Type: [Own / 1st Connection / 3rd Connection]
Error: [Error message]
Console Logs: [Relevant console output]
Diagnostic Results: [Paste diagnostic JSON]

Steps to Reproduce:
1. ...
2. ...
```

### 4. Check Known Issues
Before reporting, check:
- Is the profile view endpoint still returning 410? (Expected)
- Are you logged into LinkedIn?
- Is the profile page fully loaded?
- Do other profiles work?

---

## Success Criteria

All tests pass if:
- ✅ Basic extraction works on your own profile
- ✅ Dash endpoint is being used (check console logs)
- ✅ Fallback to embedded schema works if API fails
- ✅ 410 errors are handled gracefully
- ✅ Download functionality works
- ✅ All data sections extract correctly
- ✅ Diagnostic tool shows dashFullProfile as working

---

## Automated Testing (Future)

Consider adding automated tests for:
- Mock API responses
- Parser logic with sample data
- Edge cases (empty fields, special characters)
- Performance benchmarks

See `test/` directory (if implemented) for automated tests.

---

## Questions?

- See [DIAGNOSTIC-GUIDE.md](./DIAGNOSTIC-GUIDE.md) for troubleshooting
- See [API-CHANGES-2024.md](./API-CHANGES-2024.md) for technical details
- Check browser console for detailed logs (enable debug mode)

