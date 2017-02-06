window.addEventListener('DOMContentLoaded', function() {
  function upload() {
    const files = document.getElementById('files').files;
    if (!files.length) {
      return alert('Select a file, please');
    }
    const sent = document.getElementById('sent');
    const progressDiv = document.getElementById('progress');
    const doneDiv = document.getElementById('done');

    const file = files[0];
    const upload = gcsUploader.run(file);
    upload.onprogress = function(progress) {
      progressDiv.style.display = 'block';
      doneDiv.style.display = 'none';
      console.log('Progress ', progress);
      sent.textContent = progress;
    };
    upload.onerror = function(error) {
      console.log('Error', error);
    };
    upload.ondone = function() {
      progressDiv.style.display = 'none';
      doneDiv.style.display = 'block';
      console.log('Done');
    };
    upload.oncancel = function() {
      progressDiv.style.display = 'none';
      doneDiv.style.display = 'none';
      console.log('Cancel');
    };
    const total = document.getElementById('total');
    total.textContent = upload.size;
    document.getElementById('cancel').addEventListener('click', upload.cancel.bind(upload));
  }

  document.getElementById('upload').addEventListener('click', upload);
});
