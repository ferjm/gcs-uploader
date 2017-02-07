/**
 * This module implements the logic to perform resumable uploads to GCS
 * from a web browser.
 *
 * It makes use of the File and FileReader Web APIs and it requires a small
 * server piece able to request and provide resumable uploads session URIs.
 *
 * Usage:
 *
 * ```javascript
 * import gcsUploader from 'gcs-uploader';
 *
 * const upload = gcsUploader.run(file);
 * upload.onprogress: function(progress) {
 *   console.log('Sent', progress.sent);
 *   console.log('Pending', progress.pending);
 * };
 * upload.ondone: function(info) {
 *   console.log('File uploaded. Metadata', info);
 * };
 * upload.oncancel: function() {...};
 * upload.onpause: function() {...};
 * upload.onerror: function(error) {
 *   console.error(error);
 * }
 *
 * // upload.cancel();
 * // upload.pause();
 * // upload.resume();
 * ```
 */

'use strict';

import Steamer from './steamer.js';

const RESUME_OFFSET = '*';

/**
 * Upload states.
 */
const DONE = 'done';
const INPROGRESS = 'inprogress';
const PAUSE = 'pause';
const CANCEL = 'cancel';

const clearEventQueue = (eventQueue, event) => {
  while (eventQueue.length) {
    event(eventQueue.shift());
  }
};

/**
 * Helper class to keep state information about a file upload.
 *
 * Every state update causes the trigger of an event related to the
 * state change. For example, updating `upload.progress` triggers
 * the `onprogress` callback.
 */
function Upload(size, contentType, steamer) {
  // We need to queue events triggered before the callbacks are set.
  // Once a callback is set, we check the corresponding event queue
  // and fire its events.
  this.eventQueue = {
    onprogress: [],
    onerror: [],
    ondone: [],
    oncancel: [],
    onpause: []
  };

  this.size = size;
  this.contentType = contentType;
  this.steamer = steamer;
  this.sessionUri = null;

  const self = this;
  this.state = {
    _progress: 0,
    _error: null,
    _done: false,
    _cancel: false,
    _pause: false,
    set progress(offset) {
      if (!offset || offset === RESUME_OFFSET) {
        return;
      }

      const progress = offset;

      if (!self._onprogress) {
        self.eventQueue.onprogress.push(progress);
        return;
      }

      this._progress = progress;
      self._onprogress(progress);
    },
    set error(error) {
      if (!self._onerror) {
        self.eventQueue.onerror.push(error);
        return;
      }
      this._error = error;
      self._onerror(error);
    },
    set done(done) {
      if (!done) {
        return;
      }

      this._done = true;

      if (!self._ondone) {
        self.eventQueue.ondone[0] = true;
        return;
      }

      self._ondone();
    },
    set cancel(cancel) {
      if (!cancel) {
        return;
      }

      this._cancel = cancel;

      if (!self._oncancel) {
        self.eventQueue.oncancel[0] = cancel;
        return;
      }

      self._oncancel();
    },
    set pause(pause) {
      this._pause = pause;

      if (!self._onpause) {
        self.eventQueue.onpause[0] = pause;
        return;
      }

      if (!pause) {
        return;
      }

      // We only trigger the onpause event when we go from
      // inprogress to pause state.
      self._onpause();
    }
  };
}

Upload.prototype = (function() {
  return {
    /**
     * Create a Upload instance.
     *
     * @constructs Upload
     *
     * @param {number} size - Upload size.
     * @param {string} contentType - Content Type of the file being uploaded.
     */
    constructor: Upload,
    set progress(progress) {
      this.state.progress = progress;
    },

    /**
     * Upload error setter. Triggers the .onerror callback.
     *
     * @param {any} error - Error details.
     */
    set error(error) {
      this.state.error = error;
    },

    /**
     * Cancel an ongoing upload. Triggers the .oncancel callback.
     */
    cancel() {
      this.state.cancel = true;
    },

    /**
     * Sets the upload as done. Triggers the .ondone callback.
     */
    done() {
      this.state.done = true;
    },

    /**
     * Pauses the upload. Triggers the .onpause callback.
     */
    pause() {
      this.state.pause = true;
    },

    /**
     * Resumes a paused upload.
     */
    resume() {
      this.state.pause = false;
      doUpload(this, RESUME_OFFSET);
    },

    /**
     * Current state getter. An upload can have three states:
     * - INPROGRESS
     * - PAUSE
     * - CANCEL
     * - DONE
     */
    get currentState() {
      if (this.state._done) {
        return DONE;
      }

      if (this.state._cancel) {
        return CANCEL;
      }

      if (this.state._pause) {
        return PAUSE;
      }

      return INPROGRESS;
    },

    /**
     * onprogress callback setter.
     *
     * @param {function} cb - callback.
     */
    set onprogress(cb) {
      this._onprogress = cb;
      clearEventQueue(this.eventQueue.onprogress, cb);
    },

    /**
     * onerror callback setter.
     *
     * @param {function} cb - callback.
     */
    set onerror(cb) {
      this._onerror = cb;
      clearEventQueue(this.eventQueue.onerror, cb);
    },

    /**
     * ondone callback setter.
     *
     * @param {function} cb - callback.
     */
    set ondone(cb) {
      this._ondone = cb;
      clearEventQueue(this.eventQueue.ondone, cb);
    },

    /**
     * oncancel callback setter.
     *
     * @param {function} cb - callback.
     */
    set oncancel(cb) {
      this._oncancel = cb;
      clearEventQueue(this.eventQueue.oncancel, cb);
    },

    /**
     * onpause callback setter.
     *
     * @param {function} cb - callback.
     */
    set onpause(cb) {
      this._onpause = cb;
      clearEventQueue(this.eventQueue.onpause, cb);
    }
  };
})();

/**
 * In order to be able to perform a resumable upload to GCS we need to
 * obtain a session URI from GCS. This method requests the initialization
 * of a resumable upload session to a server that proxies our requests
 * to GCS.
 */
const getSessionUri = filename => {
  const SESSION_ENDPOINT =
    `https://dev-takeafile-com.appspot.com/_ah/api/gcsgatekeeper/v1/sessionuris`;
  return fetch(SESSION_ENDPOINT, {
    method: 'post',
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    },
    mode: 'cors',
    body: JSON.stringify({
      bucketFile: filename
    })
  }).then(response => {
    if (response.status !== 201 && response.status !== 200) {
      throw new Error('Could not get session URL from GCS');
    }
    return response.json();
  }).then(({ data }) => data);
};

const uploadChunk = (sessionUri, chunk, contentType, range) => {
  let options = {
    method: 'put',
    mode: 'cors'
  };

  let headers = {
    'Access-Control-Allow-Origin': '*'
  };

  if (!range.includes('*')) {
    headers = Object.assign(headers, {
      'Content-Length': chunk.size,
      'Content-Type': contentType,
      'Content-Range': range
    });
    options.body = chunk.data;
  }

  options.headers = headers;

  return fetch(sessionUri, options).then(response => {
    if (response.status === 200 || response.status == 201) {
      // Upload completed!
      return { done: true };
    }

    if (response.status === 308) {
      // Chunk uploaded, but there is still pending data to send.
      const rangeHeader = response.headers.get('Range');
      const lastByteReceived = rangeHeader.split('-')[1];
      if (!lastByteReceived) {
        throw new Error(`Invalid 'Range' header received`);
      }
      return { offset: parseInt(lastByteReceived) }
    }

    // Something went wrong, the service is unavailable, so we need to stop
    // for a bit and try to resume our upload.
    return { offset: RESUME_OFFSET };
  });
};

const doUpload = (upload, offset) => {
  upload.steamer.next(offset).then(chunk => {
    let range =
      offset ? offset === RESUME_OFFSET
                ? `bytes *`
                : `bytes ${offset}-${offset + chunk.size -1}`
             : `bytes 0-${chunk.size - 1}`;
    range = `${range}/${upload.size}`;
    return uploadChunk(upload.sessionUri, chunk, upload.contentType, range);
  }).then(response => {
    if (upload.currentState !== INPROGRESS) {
      return;
    }

    if (response.done) {
      return upload.done();
    }

    if (response.offset) {
      upload.progress = offset;
      return doUpload(upload, response.offset);
    }

    throw new Error('Unexpected response');
  }).catch(error => {
    upload.error = error;
    if (upload.currentState === INPROGRESS) {
      doUpload(upload, RESUME_OFFSET);
    }
  });
};

/**
 * Module entry point. It performs the core logic of the uploader. The basic
 * algorithm is:
 *
 * 1. Request a session URL to the GCS proxy server.
 * 2. Upload chunks of data to this session URL.
 * 2.1. If one of these chunks of data fails to upload, retry until it succeeds
 *      or state.cancel() is called.
 */
const run = (file) => {
  if (!file) {
    throw new Error('You need to provide a file to upload');
  }

  // Create a new upload instance.
  const upload = new Upload(file.size, file.type, new Steamer(file));

  // Get a session URI from Google Cloud Storage.
  getSessionUri(file.name).then(sessionUri => {
    upload.sessionUri = sessionUri;
    doUpload(upload);
  }).catch(error => {
    upload.error = error;
  });

  return upload;
};

module.exports = { run };
