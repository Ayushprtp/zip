remove Netlify use vercel for deployements
200 in 16ms (compile: 2ms, proxy.ts: 5ms, render: 8ms)
 GET /api/chat/models 200 in 16ms (compile: 3ms, proxy.ts: 5ms, render: 9ms)
 GET /api/chat/models 200 in 16ms (compile: 3ms, proxy.ts: 4ms, render: 9ms)
Deployment error: Error: Netlify access token not configured
    at deployToNetlify (src/app/api/builder/deploy/route.ts:113:11)
    at POST (src/app/api/builder/deploy/route.ts:55:22)
  111 | ): Promise<{ deploymentId: string; status: string }> {
  112 |   if (!NETLIFY_TOKEN) {
> 113 |     throw new Error("Netlify access token not configured");
      |           ^
  114 |   }
  115 |
  116 |   // Step 1: Create or get site
 POST /api/builder/deploy 500 in 189ms (compile: 40ms, proxy.ts: 9ms, render: 140ms)



and in BUilder new chat option redirect /builder page instead of the creating the new chat fix this 
and instead of AI Assistant write Builder AI 
and also fix if files have changed by Flare SH Builder AI also commited directly to the github too fix this  


and in chat mode acdd thrree mode first is 
Ask {asking anything  romt he code base}

Plan (planning)

agent(acting changing modifiying the code bases)


and all the content if user have done chatting and too much things there will be .flare-sh folder of builder typicall all ide alsso have this kind of thing .flare-sh will store chat hsitory and newchats too alll store in there isntead of taking space in my DB laod all the things there and when project is repiopens grabeed from there and 

/builder if its open exsitng repo fdont give option to slect the franlework direclty pull code from github cause it have already some work then how can ask for new framewrok or something 


and rmeove https chain from the builder pages its not needed rempve all the things realted to it and 
add
inline code edit
https://github.com/voideditor/void
like this gor though this iw ant in my code edit writing section these kind of sugegstions