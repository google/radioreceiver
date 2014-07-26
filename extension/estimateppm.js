// Copyright 2014 Google Inc. All rights reserved.
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

var opener = window['opener'];
var mainWindow = window['mainWindow'];

function exit() {
  AuxWindows.closeCurrent();
}

function startEstimating() {
  mainWindow.radio.estimatePpm(true);
  showPpmEstimate();
}

function showPpmEstimate() {
  ppm.value = mainWindow.window['radio'].getPpmEstimate();
  if (mainWindow.window['radio'].isEstimatingPpm()) {
    setTimeout(showPpmEstimate, 200);
  }
}

closeButton.addEventListener('click', exit);
estimate.addEventListener('click', startEstimating);

AuxWindows.resizeCurrentTo(350, 0);  

