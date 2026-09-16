import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import DOMPurify from 'dompurify';
import privacyHtml from '../../public/privacy.html?raw';

const privacyContent = DOMPurify.sanitize(privacyHtml, {
  ALLOWED_TAGS: ['div', 'h1', 'h2', 'p', 'ul', 'li', 'strong', 'a'],
  ALLOWED_ATTR: ['href', 'class'],
});

// The existing privacy document ships with Web and the desktop package.
// No legal terms are invented when the deployment has not supplied a document.
export default function AuthDocuments({ footer = false }) {
  const dialog = useRef(null);
  const [document, setDocument] = useState('');
  const open = (event, name) => {
    event.preventDefault();
    setDocument(name);
    dialog.current.showModal();
  };
  const close = () => dialog.current.close();
  return <>
    <a href="#terms" onClick={event => open(event, '用户协议')}>{footer ? '用户协议' : '《用户协议》'}</a>
    {footer ? ' | ' : ' 和 '}
    <a href={`${import.meta.env.BASE_URL}privacy.html`} onClick={event => open(event, '隐私政策')}>{footer ? '隐私政策' : '《隐私政策》'}</a>
    {footer && <> | <a href="#help" onClick={event => open(event, '帮助中心')}>帮助中心</a></>}
    <dialog ref={dialog} className="auth-document-dialog" aria-label={document || '帮助与政策'}>
      <div className="auth-document-heading"><h2>{document}</h2><button type="button" onClick={close} aria-label="关闭文档">×</button></div>
      {document === '隐私政策' ? <div className="auth-privacy-content" dangerouslySetInnerHTML={{ __html: privacyContent }} /> :
        <div className="auth-document-body">
          {document === '用户协议' ? <p>当前未提供用户协议正文。请向服务管理员获取完整条款，再决定是否同意和使用本服务。</p> : <>
            <p>忘记密码可通过找回密码页面处理；注册所需的邀请码由服务管理员或邀请人提供。</p>
            <p><Link to="/forgot-password" onClick={close}>找回密码</Link> · <Link to="/register" onClick={close}>注册账号</Link></p>
            <p>连接异常时，请先检查网络，再确认服务器地址；升级客户端请使用官网提供的下载入口。</p>
            <a href="https://vxinchat.com/#download" target="_blank" rel="noreferrer">打开官网下载页</a>
          </>}
        </div>}
    </dialog>
  </>;
}
