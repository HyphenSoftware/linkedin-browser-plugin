/**
 * Show who is signed in to the selected environment. While nobody is signed in, the body carries
 * `signedOut`, which hides everything marked `requiresSignIn` (see styles.css).
 * @param {Document} doc
 * @param {{name?: string, preferred_username?: string} | null} account
 */
export const showAccount = (doc, account) => {
    doc.body.classList.toggle('signedOut', !account);
    doc.getElementById('accountStatus').textContent = account ? `Signed in as ${account.name || account.preferred_username}` : 'Not signed in';
    doc.getElementById('signInButton').classList.toggle('hidden', !!account);
    doc.getElementById('signOutButton').classList.toggle('hidden', !account);
};
