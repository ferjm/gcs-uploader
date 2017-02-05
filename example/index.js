window.addEventListener('DOMContentLoaded', function() {
  function upload() {
    const files = document.getElementById('files').files;
    if (!files.length) {
      return alert('Select a file, please');
    }
    const file = files[0];
    const upload = gcsUploader.run(file);
    upload.onprogress = function(progress) {
      console.log('Progress', progress);
    };
    upload.onerror = function(error) {
      console.log('Error', error);
    };
    upload.ondone = function(info) {
      console.log('Done', info);
    };
    upload.oncancel = function() {
      console.log('Cancel');
    };
    document.getElementById('cancel').addEventListener('click', upload.cancel.bind(upload));
  }

  document.getElementById('upload').addEventListener('click', upload);
});
