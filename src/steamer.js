'use strict';

const Steamer = (() => {
  const DEFAULT_CHUNK_SIZE = 256 * 1024 * 4; // 1Mb

  /**
   * Steamer is a helper class to ease the process of slicing a file in
   * small chunks of data.
   */
  class Steamer {
    /**
     * Create a Steamer instance.
     *
     * @constructs Steamer
     *
     * @param {string} filename - File to be uploaded.
     * @param {object} chunkSize - Number of bytes of each file chunk.
     */
    constructor(filename, chunkSize) {
      if (!window.File || !window.FileReader) {
        throw new Error('Unsupported File API');
      }

      if (!filename) {
        throw new Error('Missing mandatory file name');
      }

      this.file = filename;
      this.chunkSize = chunkSize || DEFAULT_CHUNK_SIZE;

      this.reader = new FileReader();

      this.progress = 0;

      return this;
    }

    /**
     * Get the next chunk of data.
     *
     * @param {number} offset - initial byte of the data chunk.
     *
     * @return Promise that resolves with an object containing the chunk of
     * data and the number of bytes read.
     */
    next(offset) {
      if (offset === '*') {
        return Promise.resolve();
      }
      const _offset = offset || this.progress;
      let limit = _offset + this.chunkSize;
      limit = limit <= this.file.size ? limit : this.file.size;
      const blob = this.file.slice(_offset, limit);
      return new Promise((resolve, reject) => {
        this.reader.onerror = reject;
        this.reader.onloadend = event => {
          if (!event.target.readyState == FileReader.DONE) {
            return;
          }
          this.progress += event.loaded;
          resolve({
            data: event.target.result,
            size: event.loaded
          });
        };
        this.reader.readAsArrayBuffer(blob);
      });
    }
  };

  return Steamer;
})();

module.exports = Steamer;
