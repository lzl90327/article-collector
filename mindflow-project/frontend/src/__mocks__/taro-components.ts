/**
 * Taro 组件 Mock
 * 用于测试时模拟 Taro 的 UI 组件
 */

import React from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const View = function(props) { return React.createElement('div', props); };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Text = function(props) { return React.createElement('span', props); };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Image = function(props) { return React.createElement('img', props); };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Button = function(props) { return React.createElement('button', props); };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Input = function(props) {
  const onInput = props.onInput;
  const rest = Object.assign({}, props);
  delete rest.onInput;
  return React.createElement('input', Object.assign({}, rest, {
    onChange: function(e) {
      if (onInput) {
        onInput({ detail: { value: e.target.value } });
      }
    }
  }));
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Textarea = function(props) {
  const onInput = props.onInput;
  const rest = Object.assign({}, props);
  delete rest.onInput;
  return React.createElement('textarea', Object.assign({}, rest, {
    onChange: function(e) {
      if (onInput) {
        onInput({ detail: { value: e.target.value } });
      }
    }
  }));
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Checkbox = function(props) { return React.createElement('input', { type: 'checkbox', ...props }); };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Radio = function(props) { return React.createElement('input', { type: 'radio', ...props }); };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Switch = function(props) { return React.createElement('input', { type: 'checkbox', ...props }); };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Slider = function(props) { return React.createElement('input', { type: 'range', ...props }); };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Picker = function(props) { return React.createElement('div', props); };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PickerView = function(props) { return React.createElement('div', props); };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Form = function(props) { return React.createElement('form', props); };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Label = function(props) { return React.createElement('label', props); };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Video = function(props) { return React.createElement('video', props); };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Audio = function(props) { return React.createElement('audio', props); };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Camera = function(props) { return React.createElement('div', props); };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Map = function(props) { return React.createElement('div', props); };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Canvas = function(props) { return React.createElement('canvas', props); };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const OpenData = function(props) { return React.createElement('div', props); };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const WebView = function(props) { return React.createElement('iframe', props); };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Ad = function(props) { return React.createElement('div', props); };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Navigator = function(props) { return React.createElement('a', props); };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ScrollView = function(props) {
  const scrollY = props.scrollY;
  const scrollX = props.scrollX;
  const style = props.style;
  const children = props.children;
  const rest = Object.assign({}, props);
  delete rest.scrollY;
  delete rest.scrollX;
  delete rest.style;
  delete rest.children;
  const scrollStyle = {
    overflowY: scrollY ? 'auto' : undefined,
    overflowX: scrollX ? 'auto' : undefined,
    ...style,
  };
  return React.createElement('div', Object.assign({}, rest, { 'data-testid': 'scroll-view', style: scrollStyle }), children);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Swiper = function(props) { return React.createElement('div', props); };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SwiperItem = function(props) { return React.createElement('div', props); };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MovableView = function(props) { return React.createElement('div', props); };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MovableArea = function(props) { return React.createElement('div', props); };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CoverView = function(props) { return React.createElement('div', props); };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CoverImage = function(props) { return React.createElement('img', props); };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Block = function(props) { return React.createElement(React.Fragment, null, props.children); };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Slot = function(props) { return React.createElement('div', props); };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomWrapper = function(props) { return React.createElement('div', props); };

export {
  View,
  Text,
  Image,
  Button,
  Input,
  Textarea,
  Checkbox,
  Radio,
  Switch,
  Slider,
  Picker,
  PickerView,
  Form,
  Label,
  Video,
  Audio,
  Camera,
  Map,
  Canvas,
  OpenData,
  WebView,
  Ad,
  Navigator,
  ScrollView,
  Swiper,
  SwiperItem,
  MovableView,
  MovableArea,
  CoverView,
  CoverImage,
  Block,
  Slot,
  CustomWrapper,
};

export default {
  View,
  Text,
  Image,
  Button,
  Input,
  Textarea,
  Checkbox,
  Radio,
  Switch,
  Slider,
  Picker,
  PickerView,
  Form,
  Label,
  Video,
  Audio,
  Camera,
  Map,
  Canvas,
  OpenData,
  WebView,
  Ad,
  Navigator,
  ScrollView,
  Swiper,
  SwiperItem,
  MovableView,
  MovableArea,
  CoverView,
  CoverImage,
  Block,
  Slot,
  CustomWrapper,
};
