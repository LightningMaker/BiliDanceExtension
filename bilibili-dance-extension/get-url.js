// get-url.js
// 这个脚本用于获取插件本地目录的绝对路径，并传递给主网页
const div = document.createElement('div');
div.id = 'dance-ext-data';
// 获取插件本地资源的根目录路径
div.dataset.url = chrome.runtime.getURL('');
div.style.display = 'none';
document.documentElement.appendChild(div);