const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push('fx');

// Hanya font ini yang dipakai aplikasi. Font ikon lain ikut terbundel karena
// @expo/vector-icons me-require semua set ikon secara statis, lalu Metro menulisnya
// lewat --assets-dest ke res/ sehingga masuk APK (~1,9 MB). Bila menambah ikon/font
// baru, daftarkan juga di KEEP_FONTS.
const KEEP_FONTS = new Set(['SpaceMono-Regular.ttf', 'MaterialCommunityIcons.ttf']);
const STUB_FONT = path.resolve(__dirname, 'assets/fonts/SpaceMono-Regular.ttf');

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const basename = moduleName.split(/[\\/]/).pop();
  if (/\.(ttf|otf)$/.test(basename) && !KEEP_FONTS.has(basename)) {
    return { type: 'assetFiles', filePaths: [STUB_FONT] };
  }
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
