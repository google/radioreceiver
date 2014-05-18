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

/**
 * DSP functions and operations.
 */

#include <cassert>
#include <cmath>
#include <stdint.h>

#include "dsp.h"

using namespace std;

namespace radioreceiver {

float* getLowPassFIRCoeffs(int sampleRate, float halfAmplFreq, int length) {
  assert((length % 2) == 1);
  float freq = halfAmplFreq / sampleRate;
  int center = length / 2;
  float sum = 0;
  float* coefficients = new float[length];
  for (int i = 0; i < length; ++i) {
    float val;
    if (i == center) {
      val = 2 * M_PI * freq;
    } else {
      float angle = 2 * M_PI * (i + 1) / (length + 1);
      val = sin(2 * M_PI * freq * (i - center)) / (i - center);
      val *= 0.42 - 0.5 * cos(angle) + 0.08 * cos(2 * angle);
    }
    sum += val;
    coefficients[i] = val;
  }
  for (int i = 0; i < length; ++i) {
    coefficients[i] /= sum;
  }
  return coefficients;
}

Samples* samplesFromUint8(uint8_t* buffer, int length, int rate) {
  float* out = new float[length];
  for (int i = 0; i < length; ++i) {
    out[i] = buffer[i] / 128.0 - 1;
  }
  return new Samples(out, length, rate);
}


FIRFilter::FIRFilter(float* coefficients, int coefLen, int step)
    : coefficients_(coefficients), coefLen_(coefLen), step_(step),
      offset_(coefLen * step), curSamples_(new float[offset_]),
      curSampleLen_(offset_), curSampleCap_(offset_) {
  for (int i = 0; i < offset_; ++i) {
    curSamples_[i] = 0;
  }
}

FIRFilter::~FIRFilter() {
  delete curSamples_;
}

void FIRFilter::loadSamples(const Samples& samples) {
  int fullLen = samples.getLength() + offset_;
  float* newSamples = curSamples_;
  if (curSampleCap_ < fullLen) {
    newSamples = new float[fullLen];
  }
  for (int i = 0; i < offset_; ++i) {
    newSamples[i] = curSamples_[curSampleLen_ - offset_];
  }
  for (int i = offset_; i < fullLen; ++i) {
    newSamples[i] = samples.getData()[i - offset_];
  }
  if (curSampleCap_ < fullLen) {
    curSampleCap_ = fullLen;
    delete curSamples_;
    curSamples_ = newSamples;
  }
  curSampleLen_ = fullLen;
}

float FIRFilter::get(int index) {
  float out = 0;
  int sampleOff = index + offset_;
  for (int i = coefLen_ - 1; i >= 0; --i) {
    out += coefficients_[i] * curSamples_[sampleOff - i * step_];
  }
  return out;
}


Downsampler::Downsampler(int inRate, int outRate, float* coefficients, int coefLen)
    : filter_(coefficients, coefLen, 1), rateMul_(inRate / outRate),
      outRate_(outRate) {}

Samples* Downsampler::downsample(const Samples& samples) {
  filter_.loadSamples(samples);
  int outArrLen = samples.getLength() / rateMul_;
  float* outArr = new float[outArrLen];
  float readFrom = 0;
  for (int i = 0; i < outArrLen; ++i, readFrom += rateMul_) {
    outArr[i] = filter_.get((int) readFrom);
  }
  return new Samples(outArr, outArrLen, outRate_);
}


IQDownsampler::IQDownsampler(int inRate, int outRate, float* coefficients, int coefLen)
    : filter_(coefficients, coefLen, 2), rateMul_(inRate / outRate),
      outRate_(outRate) {}

void IQDownsampler::downsample(const Samples& samples, Samples** samplesI, Samples** samplesQ) {
  int numSamples = samples.getLength() / (2 * rateMul_);
  filter_.loadSamples(samples);
  float* outArrI = new float[numSamples];
  float* outArrQ = new float[numSamples];
  float readFrom = 0;
  for (int i = 0; i < numSamples; ++i, readFrom += rateMul_) {
    int idx = 2 * readFrom;
    outArrI[i] = filter_.get(idx);
    outArrQ[i] = filter_.get(idx + 1);
  }
  *samplesI = new Samples(outArrI, numSamples, outRate_);
  *samplesQ = new Samples(outArrQ, numSamples, outRate_);
}


const float FMDemodulator::kGain = 1;
const float FMDemodulator::kMaxFFactor = 0.8;


FMDemodulator::FMDemodulator(int inRate, int outRate, int maxF)
  : outRate_(outRate), amplConv_(outRate * kGain / (2 * M_PI * maxF)),
    filterCoefs_(getLowPassFIRCoeffs(inRate, maxF * kMaxFFactor, kFilterLen)),
    downsampler_(inRate, outRate, filterCoefs_, kFilterLen),
    lI_(0), lQ_(0) {}

FMDemodulator::~FMDemodulator() {
  delete filterCoefs_;
}

Samples* FMDemodulator::demodulateTuned(const Samples& samples) {
  Samples* samplesI;
  Samples* samplesQ;
  downsampler_.downsample(samples, &samplesI, &samplesQ);
  float* I = samplesI->getData();
  float* Q = samplesQ->getData();
  int outLen = samplesI->getLength();
  float* out = new float[outLen];
  for (int i = 0; i < outLen; ++i) {
    float divisor = (I[i] * I[i] + Q[i] * Q[i]);
    float deltaAngle = divisor == 0 ? 0 : ((I[i] * (Q[i] - lQ_) - Q[i]* (I[i] - lI_)) / divisor);
    out[i] = (deltaAngle + deltaAngle * deltaAngle * deltaAngle / 3) * amplConv_;
    lI_ = I[i];
    lQ_ = Q[i];
  }
  delete samplesI;
  delete samplesQ;
  return new Samples(out, outLen, outRate_);
}


ExpAverage::ExpAverage(int weight, bool calcStd)
    : weight_(weight), calcStd_(calcStd), avg_(0), std_(0) {}

float ExpAverage::add(float value) {
  avg_ = (weight_ * avg_ + value) / (weight_ + 1);
  if (calcStd_) {
    float dev = value - avg_;
    std_ = (weight_ * std_ + dev * dev) / (weight_ + 1);
  }
  return avg_;
}

StereoSeparator::StereoSeparator(int sampleRate, int pilotFreq)
    : sin_(0), cos_(1), iavg_(9999), qavg_(9999), cavg_(49999, true) {
  for (int i = 0; i < 8001; ++i) {
    float freq = (pilotFreq + i / 100 - 40) * 2 * M_PI / sampleRate;
    sinTable_[i] = sin(freq);
    cosTable_[i] = cos(freq);
  }      
}

StereoSignal* StereoSeparator::separate(const Samples& samples) {
  float* in = samples.getData();
  int outLen = samples.getLength();
  float* out = new float[outLen];
  for (int i = 0; i < outLen; ++i) {
    float hdev = iavg_.add(in[i] * sin_);
    float vdev = qavg_.add(in[i] * cos_);
    out[i] = in[i] * sin_ * cos_ * 2;
    float corr;
    if (hdev > 0) {
      corr = fmaxf(-4, fminf(4, vdev / hdev));
    } else {
      corr = vdev == 0 ? 0 : (vdev > 0 ? 4 : -4);
    }
    int idx = roundf((corr + 4) * 1000);
    float newSin = sin_ * cosTable_[idx] + cos_ * sinTable_[idx];
    cos_ = cos_ * cosTable_[idx] - sin_ * sinTable_[idx];
    sin_ = newSin;
    cavg_.add(corr * 10);
  }
  return new StereoSignal(cavg_.getStd() < kStdThres, new Samples(out, outLen, samples.getRate()));
}


Deemphasizer::Deemphasizer(int sampleRate, int timeConstant_uS)
  : mult_(exp(-1e6 / (timeConstant_uS * sampleRate))), val_(0) {}

/**
 * Deemphasizes the given samples in place.
 * @param samples The samples to deemphasize.
 */
void Deemphasizer::inPlace(const Samples& samples) {
  float* data = samples.getData();
  for (int i = 0; i < samples.getLength(); ++i) {
    val_ = (1 - mult_) * data[i] + mult_ * val_;
    data[i] = val_;
  }
}

}  // namespace radioreceiver

