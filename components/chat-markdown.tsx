import type {ReactNode} from "react";

function inline(value:string):ReactNode[]{
  return value.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean).map((part,i)=>{
    if(part.startsWith("**")&&part.endsWith("**"))return <strong key={i}>{part.slice(2,-2)}</strong>;
    if(part.startsWith("`")&&part.endsWith("`"))return <code key={i}>{part.slice(1,-1)}</code>;
    return <span key={i}>{part}</span>;
  });
}

function cells(line:string){return line.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(x=>x.trim());}

export default function ChatMarkdown({text}:{text:string}){
  const lines=text.split(/\r?\n/), blocks:ReactNode[]=[];
  for(let i=0;i<lines.length;i++){
    const line=lines[i].trim();
    if(!line)continue;
    if(line.startsWith("### ")){blocks.push(<h3 key={i}>{inline(line.slice(4))}</h3>);continue;}
    if(line.startsWith("|")&&lines[i+1]?.trim().match(/^\|?\s*:?-{3,}/)){
      const head=cells(line), rows:string[][]=[];i+=2;
      while(i<lines.length&&lines[i].trim().startsWith("|")){rows.push(cells(lines[i]));i++;}
      i--;
      blocks.push(<div className="mdtablewrap" key={i}><table className="mdtable"><thead><tr>{head.map((x,j)=><th key={j}>{inline(x)}</th>)}</tr></thead><tbody>{rows.map((row,j)=><tr key={j}>{head.map((_,k)=><td key={k}>{inline(row[k]||"—")}</td>)}</tr>)}</tbody></table></div>);
      continue;
    }
    if(/^[-*]\s+/.test(line)){
      const items:string[]=[];while(i<lines.length&&/^[-*]\s+/.test(lines[i].trim())){items.push(lines[i].trim().replace(/^[-*]\s+/,""));i++;}i--;blocks.push(<ul key={i}>{items.map((x,j)=><li key={j}>{inline(x)}</li>)}</ul>);continue;
    }
    blocks.push(<p key={i}>{inline(line)}</p>);
  }
  return <div className="chatmarkdown">{blocks}</div>;
}
