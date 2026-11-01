/** Recover lost read-only CLI responses without replaying writes or native input. */
export function retryReadOnly(read, {operation="read-only CLI state",diagnostics=[],deadline=Infinity,now=()=>Date.now()}={}) {
  for(let attempt=0;;attempt++) {
    try{return read();}
    catch(error) {
      if(!/\bETIMEDOUT\b/.test(error.message)||attempt>=2||now()>=deadline){
        if(diagnostics.length)error.observations={...error.observations,transportDiagnostics:[...diagnostics]};
        throw error;
      }
      diagnostics.push({operation,attempt:attempt+1,error:error.message});
    }
  }
}
