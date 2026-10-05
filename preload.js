// R3 Zip — puente seguro entre la interfaz y el proceso principal
const { contextBridge, ipcRenderer, webUtils } = require('electron');

const inv = (ch) => (...a) => ipcRenderer.invoke(ch, ...a);

contextBridge.exposeInMainWorld('r3', {
  list: inv('archive:list'),
  test: inv('archive:test'),
  extract: inv('archive:extract'),
  create: inv('archive:create'),
  openItem: inv('archive:open-item'),
  cancel: inv('job:cancel'),
  stat: inv('fs:stat'),
  exists: inv('fs:exists'),
  isArchive: inv('fs:is-archive'),
  pathInfo: inv('path:info'),
  join: inv('path:join'),
  openArchiveDialog: inv('dialog:open-archive'),
  pickInputs: inv('dialog:pick-inputs'),
  pickDir: inv('dialog:pick-dir'),
  saveArchiveDialog: inv('dialog:save-archive'),
  showInFolder: inv('shell:show'),
  openPath: inv('shell:open'),
  about: inv('app:about'),
  license: inv('app:license'),
  openLicensesFolder: inv('app:open-licenses-folder'),
  filePath: (file) => webUtils.getPathForFile(file),
  platform: process.platform,
  on: (ch, fn) => {
    if (!['app:action', 'app:command', 'job:progress'].includes(ch)) return;
    ipcRenderer.on(ch, (_e, data) => fn(data));
  },
});
