(function () {
  'use strict';
  if (window.location.protocol !== 'file:') return;
  window.location.replace('http://127.0.0.1:3000/site-presente.html' + window.location.search + window.location.hash);
}());
