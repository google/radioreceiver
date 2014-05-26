// Copyright 2013 Google Inc. All rights reserved.
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// 
//     http://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

var settings = window['settings'];

if (settings && settings['region']) {
  for (var i = 0; i < region.options.length; ++i) {
    if (region.options[i].value == settings['region']) {
      region.selectedIndex = i;
    }
  }
}
ppm.value = (settings && settings['ppm']) || 0;
var nerdSettings = settings && settings['nerdSettings'];

autoGain.checked = settings && settings['autoGain'];
gain.value = (settings && settings['gain']) || 0;
gain.disabled = autoGain.checked;

function save() {
  var msg = {
    'type': 'setsettings',
    'data': {
      'region': region.options[region.selectedIndex].value || 'WW',
      'nerdSettings': !!nerdSettings,
      'ppm': ppm.value || 0,
      'autoGain': autoGain.checked,
      'gain': gain.value
    }
  };
  window['opener'].postMessage(msg, '*');
  exit();
}

function exit() {
  AuxWindows.closeCurrent();
}

function showNerdSettings() {
  if (nerdSettings) {
    nerdSettingsOpen.style.display = 'block';
    nerdSettingsClosed.style.display = 'none';
    AuxWindows.resizeCurrentTo(250, 245);  
  } else {
    nerdSettingsOpen.style.display = 'none';
    nerdSettingsClosed.style.display = 'block';
    AuxWindows.resizeCurrentTo(250, 130);  
  }
}

cancel.addEventListener('click', exit);
ok.addEventListener('click', save);

nerdSettingsOpenLink.addEventListener('click', function() {
  nerdSettings = true;
  showNerdSettings();
});
nerdSettingsCloseLink.addEventListener('click', function() {
  nerdSettings = false;
  showNerdSettings();
});
autoGain.addEventListener('change', function() {
  gain.disabled = autoGain.checked;
});

showNerdSettings();

