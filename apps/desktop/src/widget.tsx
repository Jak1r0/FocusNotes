import React from 'react'
import ReactDOM from 'react-dom/client'
import { WidgetWindow } from './WidgetWindow'
import './widget.css'

ReactDOM.createRoot(document.getElementById('widget-root')!).render(
  <React.StrictMode><WidgetWindow /></React.StrictMode>,
)
