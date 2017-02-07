window.addEventListener('DOMContentLoaded', function() {
  const cancel = document.getElementById('cancel');
  const pause = document.getElementById('pause');
  const resume = document.getElementById('resume');

  function doUpload() {
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
      cancel.style.display = 'inline';
      pause.style.display = 'inline';
      resume.style.display = 'none';
      doneDiv.style.display = 'none';
      console.log('Progress ', progress);
      sent.textContent = progress;
    };
    upload.onerror = function(error) {
      console.log('Error', error);
    };
    upload.ondone = function() {
      progressDiv.style.display = 'none';
      cancel.style.display = 'none';
      pause.style.display = 'none';
      doneDiv.style.display = 'block';
      console.log('Done');
    };
    upload.oncancel = function() {
      progressDiv.style.display = 'none';
      cancel.style.display = 'none';
      pause.style.display = 'none';
      resume.style.display = 'none';
      doneDiv.style.display = 'none';
      console.log('Cancel');
    };
    upload.onpause = function() {
      pause.style.display = 'none';
      resume.style.display = 'inline';
    };
    const total = document.getElementById('total');
    total.textContent = upload.size;

    return upload;
  }

  document.getElementById('upload').addEventListener('click', function() {
    const upload = doUpload();
    cancel.addEventListener('click', upload.cancel.bind(upload));
    pause.addEventListener('click', upload.pause.bind(upload));
    resume.addEventListener('click', upload.resume.bind(upload));
  });
});
