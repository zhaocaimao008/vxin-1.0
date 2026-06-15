import React, { useState } from 'react';
import axios from 'axios';

export default function RedPacketModal({ conversation, onClose, onSent }) {
  const [amount, setAmount] = useState('');
  const [count, setCount] = useState('');
  const [greeting, setGreeting] = useState('恭喜发财，大吉大利！');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const amountNum = parseFloat(amount) || 0;
  const countNum = parseInt(count) || 0;
  const perPerson = countNum > 0 ? (amountNum / countNum).toFixed(2) : 0;
  const canSend = amountNum >= countNum && amountNum > 0 && countNum > 0 && amountNum <= 20000 && countNum <= 100;

  const send = async () => {
    if (!canSend) return;
    setSending(true);
    setError('');
    try {
      const { data } = await axios.post('/api/redpackets/send', {
        conversationId: conversation.id,
        totalAmount: amountNum,
        totalCount: countNum,
        greeting,
      });
      onSent?.(data.message);
      onClose();
    } catch (e) {
      setError(e.response?.data?.error || '发送失败');
    }
    setSending(false);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    }} onClick={onClose}>
      <div style={{
        backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '90%', maxWidth: 400,
        boxShadow: '0 10px 40px rgba(0,0,0,.16)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#1F2D3D', marginBottom: 20 }}>发红包</div>

        {error && <div style={{ padding: 10, background: 'rgba(250,81,81,.08)', color: '#FA5151', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{error}</div>}

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1F2D3D', marginBottom: 6 }}>红包金币总额 (1-20000)</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} min="1" max="20000"
            placeholder="输入金币数" style={{
              width: '100%', padding: '10px 12px', fontSize: 14, border: '1px solid #E8ECF0', borderRadius: 8,
              outline: 'none', boxSizing: 'border-box',
            }} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1F2D3D', marginBottom: 6 }}>红包个数 (1-100)</label>
          <input type="number" value={count} onChange={e => setCount(e.target.value)} min="1" max="100"
            placeholder="输入红包个数" style={{
              width: '100%', padding: '10px 12px', fontSize: 14, border: '1px solid #E8ECF0', borderRadius: 8,
              outline: 'none', boxSizing: 'border-box',
            }} />
        </div>

        {countNum > 0 && amountNum > 0 && (
          <div style={{ padding: 12, background: '#E8F8EE', borderRadius: 8, marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: '#7A8694', marginBottom: 4 }}>平均每个</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#07C160' }}>{perPerson} 金币</div>
            {amountNum < countNum && <div style={{ fontSize: 12, color: '#FA5151', marginTop: 4 }}>⚠ 总金币不能少于红包个数</div>}
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1F2D3D', marginBottom: 6 }}>祝福语 (可选)</label>
          <textarea value={greeting} onChange={e => setGreeting(e.target.value)} maxLength={100}
            placeholder="例如：恭喜发财，大吉大利！" style={{
              width: '100%', padding: '10px 12px', fontSize: 13, border: '1px solid #E8ECF0', borderRadius: 8,
              outline: 'none', boxSizing: 'border-box', resize: 'none', height: 60, fontFamily: 'inherit',
            }} />
          <div style={{ fontSize: 11, color: '#B0BAC5', marginTop: 4 }}>{greeting.length}/100</div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '9px 20px', border: '1px solid #E8ECF0', borderRadius: 8, background: '#F7F8FA',
            color: '#7A8694', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>取消</button>
          <button onClick={send} disabled={!canSend || sending} style={{
            padding: '9px 20px', borderRadius: 8, background: canSend && !sending ? '#07C160' : 'rgba(7,193,96,.4)',
            color: '#fff', fontSize: 14, fontWeight: 600, cursor: canSend && !sending ? 'pointer' : 'not-allowed',
            border: 'none',
          }}>
            {sending ? '发送中...' : '确认发送'}
          </button>
        </div>
      </div>
    </div>
  );
}
