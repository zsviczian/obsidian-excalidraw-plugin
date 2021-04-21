export function getDateString(format:string):string {
  const pad2 = (n:number) => {   
    return n>9? n.toString():'0'+n;   
  }     

  const now = new Date();   
  const M=now.getMonth()+1,H=now.getHours(),m=now.getMinutes(),d=now.getDate(),s=now.getSeconds(),yyyy=now.getFullYear();   
  const n = {
    yyyy: yyyy.toString(),
    MM  : pad2(M),
    dd  : pad2(d),
    HH  : pad2(H),
    mm  : pad2(m),
    ss  : pad2(s)
  };      

  return format.replace(/([a-zA-Z]+)/g,function (s:string, $1:string):string {
    switch($1) {
      case 'yyyy' : return n.yyyy; 
      case 'MM'   : return n.MM; 
      case 'dd'   : return n.dd; 
      case 'HH'   : return n.HH; 
      case 'mm'   : return n.mm; 
      case 'ss'   : return n.ss; 
    }
    return '';
  });   
}   
