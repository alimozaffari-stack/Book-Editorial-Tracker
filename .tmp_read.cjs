const fs=require('fs');const [f,a,b]=process.argv.slice(2);const t=fs.readFileSync(f,'utf8').split(/\r?\n/);console.log('TOTAL_LINES '+t.length);console.log(t.slice(+a,+b).join('\n'));  
