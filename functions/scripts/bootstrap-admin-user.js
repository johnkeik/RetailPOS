const admin = require('firebase-admin');

async function main() {
  const [email, tenantId, projectId] = process.argv.slice(2);
  if (!email || !tenantId || !projectId) {
    throw new Error(
      'Usage: npm run bootstrap:admin -- <email> <tenantId> <projectId>'
    );
  }

  const activeProject = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
  if (activeProject && activeProject !== projectId) {
    throw new Error(`Active project ${activeProject} does not match ${projectId}.`);
  }

  admin.initializeApp({ projectId });
  const auth = admin.auth();
  const firestore = admin.firestore();
  const user = await auth.getUserByEmail(email);
  if (user.disabled) {
    throw new Error(`Firebase Auth user ${email} is disabled.`);
  }

  const profileRef = firestore.doc(`users/${user.uid}`);
  const existing = await profileRef.get();
  if (existing.exists) {
    const profile = existing.data();
    if (profile.tenantId === tenantId && profile.role === 'OWNER' && profile.active !== false) {
      console.log(`Admin profile already exists for ${email} in ${tenantId}.`);
      return;
    }
    throw new Error(`Refusing to overwrite existing profile users/${user.uid}.`);
  }

  await profileRef.create({
    tenantId,
    role: 'OWNER',
    active: true,
    email: user.email || email,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log(`Created OWNER profile for ${email} in ${tenantId} (${projectId}).`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});