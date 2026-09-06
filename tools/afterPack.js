const fs = require('fs');
const path = require('path');
const resedit = require('resedit');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;
  const exePath = path.join(context.appOutDir, 'SmartPlanCoach.exe');
  const icoPath = path.join(context.packager.projectDir, 'build', 'icon.ico');
  if (!fs.existsSync(exePath) || !fs.existsSync(icoPath)) return;

  const exe = resedit.NtExecutable.from(fs.readFileSync(exePath), { ignoreCert: true });
  const res = resedit.NtExecutableResource.from(exe);
  const groups = resedit.Resource.IconGroupEntry.fromEntries(res.entries);
  if (!groups.length) {
    console.warn('afterPack: no icon group in executable');
    return;
  }
  const iconFile = resedit.Data.IconFile.from(fs.readFileSync(icoPath));
  resedit.Resource.IconGroupEntry.replaceIconsForResource(
    res.entries,
    groups[0].id,
    groups[0].lang,
    iconFile.icons.map((item) => item.data)
  );

  const versions = resedit.Resource.VersionInfo.fromEntries(res.entries);
  if (versions.length === 1) {
    const vi = versions[0];
    const langs = vi.getAllLanguagesForStringValues();
    const lang = langs[0] || { lang: 1033, codepage: 1200 };
    vi.setStringValues(lang, {
      FileDescription: '智能计划教练',
      ProductName: '智能计划教练',
      CompanyName: 'Smart Plan Coach',
      LegalCopyright: 'Copyright 2026 Smart Plan Coach',
      InternalName: 'SmartPlanCoach',
      OriginalFilename: 'SmartPlanCoach.exe'
    });
    vi.setFileVersion(1, 0, 0, 0);
    vi.setProductVersion(1, 0, 0, 0);
    vi.outputToResourceEntries(res.entries);
  }

  res.outputResource(exe);
  fs.writeFileSync(exePath, Buffer.from(exe.generate()));
  console.log('afterPack: updated icon and version info');
};
