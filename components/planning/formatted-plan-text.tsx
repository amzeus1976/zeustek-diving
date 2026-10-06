import {Fragment, type ReactNode} from 'react';
import {matchingPlanText, type PlanTextNode} from '../../lib/planning/formatted-text';
import styles from './rich-text-field.module.css';

function renderNode(node: PlanTextNode, key: number): ReactNode {
  const content = node.content?.map(renderNode);
  if (node.type === 'text') {
    let value:ReactNode = node.text;
    for (const mark of node.marks ?? []) value = mark.type === 'bold' ? <strong>{value}</strong> : mark.type === 'italic' ? <em>{value}</em> : <u>{value}</u>;
    return <Fragment key={key}>{value}</Fragment>;
  }
  if (node.type === 'hardBreak') return <br key={key}/>;
  if (node.type === 'paragraph') return <p key={key}>{content?.length ? content : <br/>}</p>;
  if (node.type === 'listItem') return <li key={key}>{content}</li>;
  if (node.type === 'bulletList') return <ul key={key}>{content}</ul>;
  if (node.type === 'orderedList') return <ol key={key} start={node.attrs?.start ?? 1}>{content}</ol>;
  return <Fragment key={key}>{content}</Fragment>;
}

export function FormattedPlanText({text,document,className=''}:{text:string;document?:unknown;className?:string|undefined}) {
  const matched = matchingPlanText(text, document);
  return <div className={`${styles.readOnly} ${className}`}>{matched ? matched.content?.map(renderNode) : text}</div>;
}
