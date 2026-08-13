/**
 * useOverlayManager — 弹窗/覆盖层统一管理 Hook
 * 从 ChatWindow 拆分：所有 boolean/枚举型 UI 开关状态
 *
 * 收敛 ~15 个散落的 show* useState 到一个统一管理器，
 * 保证同一时间只有一个"主弹窗"打开（互斥），防止多弹窗叠加。
 *
 * 主弹窗（互斥）：groupInfo / userProfile / redPacket / transfer /
 *                 cardPicker / forwardPicker / chatFiles / scheduleSend /
 *                 pinnedDetail / announceDetail / searchBar
 * 独立状态（可共存）：lightbox / videoPreview / ctxMenu / multiSelect
 */
import { useState, useCallback } from 'react';

const INITIAL = {
  // 主弹窗（互斥，同时只能开一个）
  groupInfo:     false,
  userProfile:   null,    // userId | null
  redPacket:     false,
  transfer:      false,
  cardPicker:    false,
  forwardPicker: null,    // { msg } | { msgs } | null
  chatFiles:     false,
  scheduleSend:  false,
  pinnedDetail:  false,
  announceDetail:false,
  searchBar:     false,
  // 独立状态（可叠加）
  lightbox:    null,    // { urls, idx } | null
  videoPreview:null,   // { url, name } | null
  ctxMenu:     null,   // { x, y, msg } | null
  multiSelect: false,
};

export function useOverlayManager() {
  const [state, setState] = useState(INITIAL);

  // 互斥打开主弹窗（关闭其他主弹窗）
  const MUTUALLY_EXCLUSIVE = ['groupInfo','userProfile','redPacket','transfer',
    'cardPicker','forwardPicker','chatFiles','scheduleSend','pinnedDetail','announceDetail','searchBar'];

  const open = useCallback((key, value = true) => {
    setState(prev => {
      const next = { ...prev };
      // 互斥关闭其他主弹窗
      if (MUTUALLY_EXCLUSIVE.includes(key)) {
        MUTUALLY_EXCLUSIVE.forEach(k => { next[k] = k === key ? value : (typeof prev[k] === 'boolean' ? false : null); });
      } else {
        next[key] = value;
      }
      return next;
    });
  }, []); // eslint-disable-line

  const close = useCallback((key) => {
    setState(prev => ({
      ...prev,
      [key]: typeof prev[key] === 'boolean' ? false : null,
    }));
  }, []);

  const closeAll = useCallback(() => setState(INITIAL), []);

  // 便捷 setter（向下兼容旧 ChatWindow 调用模式）
  const setters = {};
  Object.keys(INITIAL).forEach(key => {
    setters[`set${key.charAt(0).toUpperCase()}${key.slice(1)}`] = (v) => open(key, v);
  });

  return { ...state, open, close, closeAll, ...setters };
}
