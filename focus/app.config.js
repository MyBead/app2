// Extends app.json. CI sets BUILD_NUMBER so each APK gets a higher versionCode and
// Android installs it as an update over the previous build.
module.exports = ({ config }) => {
  const build = Number(process.env.BUILD_NUMBER);
  if (!build) return config;
  return { ...config, android: { ...config.android, versionCode: build } };
};
