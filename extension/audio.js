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

/**
 * A class to play a series of sample buffers at a constant rate.
 * @constructor
 */
function Player() {
  var OUT_RATE = 48000;
  var TIME_BUFFER = 0.05;

  var lastPlayedAt = -1;
  var frameno = 0;

  window.AudioContext = window.AudioContext || window.webkitAudioContext;
  var ac = new (window.AudioContext || window.webkitAudioContext)();

  /**
   * Queues the given samples for playing at the appropriate time.
   * @param {Samples} leftSamples The samples for the left speaker.
   * @param {Samples} rightSamples The samples for the right speaker.
   */
  function play(leftSamples, rightSamples) {
    var buffer = ac.createBuffer(2, leftSamples.data.length, leftSamples.rate);
    buffer.getChannelData(0).set(leftSamples.data);
    buffer.getChannelData(1).set(rightSamples.data);
    var source = ac.createBufferSource();
    source.buffer = buffer;
    source.connect(ac.destination);
    lastPlayedAt = Math.max(
        lastPlayedAt + leftSamples.data.length / leftSamples.rate,
        ac.currentTime + TIME_BUFFER);
    source.start(lastPlayedAt);
  }

  return {
    play: play
  };
}

