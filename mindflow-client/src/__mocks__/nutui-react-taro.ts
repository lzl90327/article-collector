/**
 * NutUI React Taro Mock
 * 用于测试时模拟 NutUI 组件
 */

import React from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Button = function(props) {
  const { type, size, shape, fill, block, loading, disabled, children, onClick, ...rest } = props;
  return React.createElement('button', {
    type: 'button',
    disabled: disabled || loading,
    onClick: onClick,
    'data-type': type,
    'data-size': size,
    'data-shape': shape,
    'data-fill': fill,
    'data-block': block,
    'data-loading': loading,
    ...rest
  }, loading && React.createElement('span', null, 'Loading...'), children);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Input = function(props) {
  const { type, onChange, onBlur, onFocus, ...rest } = props;
  return React.createElement('input', {
    type: type || 'text',
    onChange: (e) => onChange?.(e.target.value),
    onBlur: (e) => onBlur?.(e.target.value),
    onFocus: (e) => onFocus?.(e.target.value),
    ...rest
  });
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TextArea = function(props) {
  const { onChange, onBlur, onFocus, autoHeight, ...rest } = props;
  return React.createElement('textarea', {
    onChange: (e) => onChange?.(e.target.value),
    onBlur: (e) => onBlur?.(e.target.value),
    onFocus: (e) => onFocus?.(e.target.value),
    'data-auto-height': autoHeight,
    ...rest
  });
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Toast = function(props) {
  const { visible, type, content, position, children } = props;
  if (!visible) return null;
  return React.createElement('div', {
    'data-testid': 'toast',
    'data-type': type,
    'data-position': position
  }, content || children);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Loading = function(props) {
  const { visible, type, text, vertical } = props;
  if (visible === false) return null;
  return React.createElement('div', {
    'data-testid': 'loading',
    'data-type': type || 'circular',
    'data-vertical': vertical
  }, React.createElement('span', null, 'Loading...'), text && React.createElement('span', null, text));
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Cell = function(props) {
  const { title, description, extra, children, onClick, ...rest } = props;
  return React.createElement('div', { onClick: onClick, ...rest },
    title && React.createElement('div', null, title),
    description && React.createElement('div', null, description),
    children,
    extra && React.createElement('div', null, extra)
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const CellGroup = function(props) {
  const { title, description, children, ...rest } = props;
  return React.createElement('div', rest,
    title && React.createElement('div', null, title),
    description && React.createElement('div', null, description),
    children
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ConfigProvider = function(props) {
  const { children } = props;
  return React.createElement(React.Fragment, null, children);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Empty = function(props) {
  const { title, description, image, actions, ...rest } = props;
  return React.createElement('div', rest,
    image && React.createElement('div', null, image),
    title && React.createElement('div', null, title),
    description && React.createElement('div', null, description),
    actions && React.createElement('div', null, actions)
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const NavBar = function(props) {
  const { title, left, right, onBack, ...rest } = props;
  return React.createElement('div', rest,
    left && React.createElement('div', { onClick: onBack }, left),
    title && React.createElement('div', null, title),
    right && React.createElement('div', null, right)
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Icon = function(props) {
  const { name, size, color, onClick, ...rest } = props;
  return React.createElement('span', {
    onClick: onClick,
    style: { fontSize: size, color },
    'data-name': name,
    ...rest
  }, name);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Divider = function(props) {
  const { contentPosition, dashed, hairline, children, ...rest } = props;
  return React.createElement('div', {
    'data-content-position': contentPosition || 'center',
    'data-dashed': dashed,
    'data-hairline': hairline !== false,
    ...rest
  }, children);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Tag = function(props) {
  const { type, color, textColor, plain, round, mark, closeable, onClose, children, ...rest } = props;
  return React.createElement('span', {
    'data-type': type || 'default',
    'data-plain': plain,
    'data-round': round,
    'data-mark': mark,
    style: { backgroundColor: color, color: textColor },
    ...rest
  }, children, closeable && React.createElement('span', { onClick: onClose }, '×'));
};

const NutUI = {
  Button,
  Input,
  TextArea,
  Toast,
  Loading,
  Cell,
  CellGroup,
  ConfigProvider,
  Empty,
  NavBar,
  Icon,
  Divider,
  Tag,
};

export default NutUI;
