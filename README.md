# Google Cloud Storage uploader.

Javascript library to ease resumable file uploads from browsers to [Google Cloud Storage](https://cloud.google.com/storage/).

## Build

This command generates the library bundles in the `dist` folder.
```ssh
gulp build
```

## Usage
```javascript
import gcsUploader from 'dist/gcs-uploader';

const upload = gcsUploader.run(file);
upload.onprogress: function(progress) {
  console.log('Sent', progress.sent);
  console.log('Pending', progress.pending);
};
upload.ondone: function(info) {
  console.log('File uploaded. Metadata', info);
};
upload.oncancel: function() {...};
upload.onerror: function(error) {
  console.error(error);
}

// upload.cancel();
```
