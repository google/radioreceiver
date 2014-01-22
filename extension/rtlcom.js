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
 * Low-level communications with the RTL2832U-based dongle.
 * @param {ConnectionHandle} conn The USB connection handle.
 * @constructor
 */
function RtlCom(conn) {

  /**
   * Whether to log all USB transfers.
   */
  var VERBOSE = false;

  /**
   * Set in the control messages' index field for write operations.
   */
  var WRITE_FLAG = 0x10;

  /**
   * Function to call if there was an error in USB transfers.
   */
  var onError;

  /**
   * Writes a buffer into a dongle's register.
   * @param {number} block The register's block number.
   * @param {number} reg The register number.
   * @param {ArrayBuffer} buffer The buffer to write.
   * @param {Function} kont The continuation for this function.
   */
  function writeRegBuffer(block, reg, buffer, kont) {
    writeCtrlMsg(reg, block | WRITE_FLAG, buffer, kont);
  }

  /**
   * Reads a buffer from a dongle's register.
   * @param {number} block The register's block number.
   * @param {number} reg The register number.
   * @param {number} length The length in bytes of the buffer to read.
   * @param {Function} kont The continuation for this function.
   *     It receives the read buffer.
   */
  function readRegBuffer(block, reg, length, kont) {
    readCtrlMsg(reg, block, length, kont);
  }

  /**
   * Writes a value into a dongle's register.
   * @param {number} block The register's block number.
   * @param {number} reg The register number.
   * @param {number} value The value to write.
   * @param {number} length The width in bytes of this value.
   * @param {Function} kont The continuation for this function.
   */
  function writeReg(block, reg, value, length, kont) {
    writeCtrlMsg(reg, block | WRITE_FLAG, numberToBuffer(value, length), kont);
  }

  /**
   * Reads a value from a dongle's register.
   * @param {number} block The register's block number.
   * @param {number} reg The register number.
   * @param {number} length The width in bytes of the value to read.
   * @param {Function} kont The continuation for this function.
   *     It receives the decoded value.
   */
  function readReg(block, reg, length, kont) {
    readCtrlMsg(reg, block, length, function(data) {
      kont(bufferToNumber(data));
    });
  }

  /**
   * Writes a masked value into a dongle's register.
   * @param {number} block The register's block number.
   * @param {number} reg The register number.
   * @param {number} value The value to write.
   * @param {number} mask The mask for the value to write.
   * @param {Function} kont The continuation for this function.
   */
  function writeRegMask(block, reg, value, mask, kont) {
    if (mask == 0xff) {
      writeReg(block, reg, value, 1, kont);
    } else {
      readReg(block, reg, 1, function(old) {
      value &= mask;
      old &= ~mask;
      value |= mask;
      writeReg(block, reg, value, 1, kont);
      });
    }
  }

  /**
   * Reads a value from a demodulator register.
   * @param {number} page The register page number.
   * @param {number} addr The register's address.
   * @param {Function} kont The continuation for this function.
   *     It receives the decoded value.
   */
  function readDemodReg(page, addr, kont) {
    readReg(page, (addr << 8) | 0x20, 1, kont);
  }

  /**
   * Writes a value into a demodulator register.
   * @param {number} page The register page number.
   * @param {number} addr The register's address.
   * @param {number} value The value to write.
   * @param {number} len The width in bytes of this value.
   * @param {Function} kont The continuation for this function.
   */
  function writeDemodReg(page, addr, value, len, kont) {
    writeRegBuffer(page, (addr << 8) | 0x20, numberToBuffer(value, len, true), kont);
  }

  /**
   * Opens the I2C repeater.
   * @param {Function} kont The continuation for this function.
   */
  function openI2C(kont) {
    writeDemodReg(1, 1, 0x18, 1, kont);
  }

  /**
   * Closes the I2C repeater.
   * @param {Function} kont The continuation for this function.
   */
  function closeI2C(kont) {
    writeDemodReg(1, 1, 0x10, 1, kont);
  }

  /**
   * Reads a value from an I2C register.
   * @param {number} addr The device's address.
   * @param {number} reg The register number.
   * @param {Function} kont The continuation for this function.
   */
  function readI2CReg(addr, reg, kont) {
    writeRegBuffer(BLOCK.I2C, addr, new Uint8Array([reg]).buffer, function() {
    readReg(BLOCK.I2C, addr, 1, kont);
    });
  }

  /**
   * Writes a value to an I2C register.
   * @param {number} addr The device's address.
   * @param {number} reg The register number.
   * @param {number} value The value to write.
   * @param {number} len The width in bytes of this value.
   * @param {Function} kont The continuation for this function.
   */
  function writeI2CReg(addr, reg, value, kont) {
    writeRegBuffer(BLOCK.I2C, addr, new Uint8Array([reg, value]).buffer, kont);
  }

  /**
   * Reads a buffer from an I2C register.
   * @param {number} addr The device's address.
   * @param {number} reg The register number.
   * @param {number} len The number of bytes to read.
   * @param {Function} kont The continuation for this function.
   */
  function readI2CRegBuffer(addr, reg, len, kont) {
    writeRegBuffer(BLOCK.I2C, addr, new Uint8Array([reg]).buffer, function() {
    readRegBuffer(BLOCK.I2C, addr, len, kont);
    });
  }

  /**
   * Writes a buffer to an I2C register.
   * @param {number} addr The device's address.
   * @param {number} reg The register number.
   * @param {ArrayBuffer} buffer The buffer to write.
   * @param {Function} kont The continuation for this function.
   */
  function writeI2CRegBuffer(addr, reg, buffer, kont) {
    var data = new Uint8Array(buffer.byteLength + 1);
    data[0] = reg;
    data.set(new Uint8Array(buffer), 1);
    writeRegBuffer(BLOCK.I2C, addr, data.buffer, kont);
  }

  /**
   * Decodes a buffer as a little-endian number.
   * @param {ArrayBuffer} buffer The buffer to decode.
   * @return {number} The decoded number.
   */
  function bufferToNumber(buffer) {
    var len = buffer.byteLength;
    var dv = new DataView(buffer);
    if (len == 0) {
      return null;
    } else if (len == 1) {
      return dv.getUint8(0);
    } else if (len == 2) {
      return dv.getUint16(0, true);
    } else if (len == 4) {
      return dv.getUint32(0, true);
    }
    throw 'Cannot parse ' + len + '-byte number';
  }

  /**
   * Encodes a number into a buffer.
   * @param {number} value The number to encode.
   * @param {number} len The number of bytes to encode into.
   * @param {boolean=} opt_bigEndian Whether to use a big-endian encoding.
   */
  function numberToBuffer(value, len, opt_bigEndian) {
    var buffer = new ArrayBuffer(len);
    var dv = new DataView(buffer);
    if (len == 1) {
      dv.setUint8(0, value);
    } else if (len == 2) {
      dv.setUint16(0, value, !opt_bigEndian);
    } else if (len == 4) {
      dv.setUint32(0, value, !opt_bigEndian);
    } else {
      throw 'Cannot write ' + len + '-byte number';
    }
    return buffer;
  }

  /**
   * Sends a USB control message to read from the device.
   * @param {number} value The value field of the control message.
   * @param {number} index The index field of the control message.
   * @param {number} length The number of bytes to read.
   * @param {Function} kont The continuation for this function.
   */
  function readCtrlMsg(value, index, length, kont) {
    var ti = {
      'requestType': 'vendor',
      'recipient': 'device',
      'direction': 'in',
      'request': 0,
      'value': value,
      'index': index,
      'length': Math.max(8, length)
    };
    chrome.usb.controlTransfer(conn, ti, function(event) {
      var data = event.data.slice(0, length);
      if (VERBOSE) {
        console.log('IN value 0x' + value.toString(16) + ' index 0x' +
            index.toString(16));
        console.log('    read -> ' + dumpBuffer(data));
      }
      var rc = event.resultCode;
      if (rc != 0) {
        var msg = 'USB read failed (value 0x' + value.toString(16) +
            ' index 0x' + index.toString(16) + '), rc=' + rc +
            ', lastErrorMessage="' + chrome.runtime.lastError.message + '"';
        if (onError) {
          console.error(msg);
          return onError(msg);
        } else {
          throw msg;
        }
      }
      kont(data);
    });
  }

  /**
   * Sends a USB control message to write to the device.
   * @param {number} value The value field of the control message.
   * @param {number} index The index field of the control message.
   * @param {ArrayBuffer} buffer The buffer to write to the device.
   * @param {Function} kont The continuation for this function.
   */
  function writeCtrlMsg(value, index, buffer, kont) {
    var ti = {
      'requestType': 'vendor',
      'recipient': 'device',
      'direction': 'out',
      'request': 0,
      'value': value,
      'index': index,
      'data': buffer
    };
    chrome.usb.controlTransfer(conn, ti, function(event) {
      if (VERBOSE) {
        console.log('OUT value 0x' + value.toString(16) + ' index 0x' +
            index.toString(16) + ' data ' + dumpBuffer(buffer));
      }
      var rc = event.resultCode;
      if (rc != 0) {
        var msg = 'USB write failed (value 0x' + value.toString(16) +
            ' index 0x' + index.toString(16) + ' data ' + dumpBuffer(buffer) +
            '), rc=' + rc + ', lastErrorMessage="' +
            chrome.runtime.lastError.message + '"';
        if (onError) {
          console.error(msg);
          return onError(msg);
        } else {
          throw msg;
        }
      }
      kont();
    });
  }

  /**
   * Does a bulk transfer from the device.
   * @param {number} length The number of bytes to read.
   * @param {Function} kont The continuation for this function. It receives the
   *     received buffer.
   */
  function readBulk(length, kont) {
    var ti = {
      'direction': 'in',
      'endpoint': 1,
      'length': length
    };
    chrome.usb.bulkTransfer(conn, ti, function(event) {
      if (VERBOSE) {
        console.log('IN BULK requested ' + length + ' received ' + event.data.byteLength);
      }
      var rc = event.resultCode;
      if (rc != 0) {
        var msg = 'USB bulk read failed (length 0x' + length.toString(16) +
            '), rc=' + rc + ', lastErrorMessage="' +
            chrome.runtime.lastError.message + '"';
        if (onError) {
          console.error(msg);
          return onError(msg);
        } else {
          throw msg;
        }
      }
      kont(event.data);
    });
  }

  /**
   * Claims the USB interface.
   * @param {Function} kont The continuation for this function.
   */
  function claimInterface(kont) {
    chrome.usb.claimInterface(conn, 1, kont);
  }

  /**
   * Releases the USB interface.
   * @param {Function} kont The continuation for this function.
   */
  function releaseInterface(kont) {
    chrome.usb.releaseInterface(conn, 1, kont);
  }

  /**
   * Performs several write operations as specified in an array.
   * @param {Array.<Array.<number>>} array The operations to perform.
   * @param {Function} kont The continuation for this function.
   */
  function writeEach(array, kont) {
    var index = 0;
    function iterate() {
      if (index >= array.length) {
        kont();
      } else {
        var line = array[index++];
        if (line[0] == CMD.REG) {
          writeReg(line[1], line[2], line[3], line[4], iterate);
        } else if (line[0] == CMD.REGMASK) {
          writeRegMask(line[1], line[2], line[3], line[4], iterate);
        } else if (line[0] == CMD.DEMODREG) {
          writeDemodReg(line[1], line[2], line[3], line[4], iterate);
        } else if (line[0] == CMD.I2CREG) {
          writeI2CReg(line[1], line[2], line[3], iterate);
        } else {
          throw 'Unsupported operation [' + line + ']';
        }
      }
    }
    iterate();
  }

  /**
   * Sets a function to call in case of error.
   * @param {Function} func The function to call.
   */
  function setOnError(func) {
    onError = func;
  }

  /**
   * Returns a string representation of a buffer.
   * @param {ArrayBuffer} buffer The buffer to display.
   * @return {string} The string representation of the buffer.
   */
  function dumpBuffer(buffer) {
    var bytes = [];
    var arr = new Uint8Array(buffer);
    for (var i = 0; i < arr.length; ++i) {
      bytes.push('0x' + arr[i].toString(16));
    }
    return '[' + bytes + ']';
  }


  return {
    writeRegister: writeReg,
    readRegister: readReg,
    writeRegMask: writeRegMask,
    demod: {
      readRegister: readDemodReg,
      writeRegister: writeDemodReg
    },
    i2c: {
      open: openI2C,
      close: closeI2C,
      readRegister: readI2CReg,
      writeRegister: writeI2CReg,
      readRegBuffer: readI2CRegBuffer
    },
    bulk: {
      readBuffer: readBulk
    },
    iface: {
      claim: claimInterface,
      release: releaseInterface
    },
    writeEach: writeEach,
    setOnError: setOnError
  };
}

/**
 * Commands for writeEach.
 */
CMD = {
  REG: 1,
  REGMASK: 2,
  DEMODREG: 3,
  I2CREG: 4
};

/**
 * Register blocks.
 */
BLOCK = {
  DEMOD: 0x000,
  USB: 0x100,
  SYS: 0x200,
  I2C: 0x600
};

/**
 * Device registers.
 */
REG = {
  SYSCTL: 0x2000,
  EPA_CTL: 0x2148,
  EPA_MAXPKT: 0x2158,
  DEMOD_CTL: 0x3000,
  DEMOD_CTL_1: 0x300b
};

