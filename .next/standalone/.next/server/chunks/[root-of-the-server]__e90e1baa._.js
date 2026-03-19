module.exports=[54799,(e,t,n)=>{t.exports=e.x("crypto",()=>require("crypto"))},44101,e=>{"use strict";var t=e.i(47909),n=e.i(74017),a=e.i(96250),r=e.i(59756),o=e.i(61916),i=e.i(74677),s=e.i(69741),l=e.i(16795),d=e.i(87718),u=e.i(95169),c=e.i(47587),g=e.i(66012),m=e.i(70101),p=e.i(26937),f=e.i(10372),h=e.i(93695);e.i(52474);var b=e.i(5232),E=e.i(89171),w=e.i(54799);e.i(89228);var v=e.i(91601),y=e.i(58708),_=e.i(67652),N=e.i(44687),R=e.i(18069);async function k(e){let t=(0,_.getSupabaseClient)(),{data:n,error:a}=await t.from("tenant_agent_config").select("empathy_enabled, allow_discount, max_discount_amount, signature, language_default").eq("tenant_id",e).single();if(a||!n)throw Error(`Agent config not found for tenant "${e}": ${a?.message??"no row returned"}`);return{empathyEnabled:n.empathy_enabled??!0,allowDiscount:n.allow_discount??!1,maxDiscountAmount:n.max_discount_amount??0,signature:n.signature??"",languageDefault:n.language_default??"nl"}}async function T(e){let t=(0,_.getSupabaseClient)(),{data:n,error:a}=await t.from("tenant_templates").select("id, intent, template_text, confidence_weight").eq("tenant_id",e).eq("is_active",!0);if(a)return console.warn("[templateLoader] failed to load templates:",a.message),new Map;let r=new Map;for(let e of n??[])r.set(e.intent,{id:e.id,templateText:e.template_text,confidenceWeight:e.confidence_weight??1});return r}async function A(e,t){let{error:n}=await e.from("tickets").insert({tenant_id:t.tenantId,gmail_message_id:t.gmailMessageId,gmail_thread_id:t.gmailThreadId,from_email:t.fromEmail,from_name:t.fromName||null,subject:t.subject.slice(0,255),body_text:t.bodyText,intent:t.intent,confidence:t.confidence,status:"draft",ai_draft:t.aiDraft});n&&console.warn("[generate] ticket upsert failed:",n.message)}async function x(e,t){let{error:n}=await e.from("support_events").insert({tenant_id:t.tenantId,user_id:t.userId,request_id:t.requestId,source:t.source,subject:t.subject.slice(0,120),intent:t.intent,confidence:t.confidence,template_id:t.templateId,latency_ms:t.latencyMs,draft_text:t.draftText,outcome:t.outcome});n&&console.warn("[generate] support_event insert failed:",n.message)}function I(e){return Math.max(0,Math.min(1,e))}let O=["beschadigd","kapot","defect","ingedeukt","scheur","kras","damaged","broken"],S=new Set(["order_status","return_request","damaged","missing_items","complaint","warranty","cancellation","payment","shipping","product_question","compliment","fallback"]);async function j(e){let t,n,a,r,o=Date.now(),i=w.default.randomUUID();try{({tenantId:a,role:t,userId:n}=await (0,R.getTenantId)(e))}catch(t){let e="Not authenticated"===t.message?401:403;return E.NextResponse.json({error:t.message},{status:e})}if(!["admin","system"].includes(t))return E.NextResponse.json({error:"Forbidden: insufficient role"},{status:403});try{r=await e.json()}catch{return E.NextResponse.json({error:"Invalid JSON body"},{status:400})}let s=r.original_message_id||r.message_id||null,l=r.threadId||r.thread_id||null;console.log("=== FULL REQUEST BODY ==="),console.log(JSON.stringify(r,null,2)),console.log("=== END REQUEST BODY ===");let d=r.tenant_id?String(r.tenant_id).trim().replace(/^=+/,""):a;if(!d)return E.NextResponse.json({error:"tenant_id missing from request"},{status:400});console.log(`[generate] resolved tenantId=${d} (source=${r.tenant_id?"body":"auth"})`);let u=(0,_.getSupabaseClient)(),c=(0,N.getSupabaseAdmin)(),g=String(r.source??"api").trim(),m="";try{var p,f,h,b;let e,t,a,w,_;m=String(r.subject??"").trim();let N=String(r.body??r.text??r.snippet??"").trim(),R=function(e){let t=String(e??"").trim();if(!t)return"";let n=t.match(/<([^>]+)>/);return(n?.[1]??t).trim()}(r.from??r.From??r.sender??r.email),j=r.customer?.name||R||"";try{e=await k(d)}catch{console.warn(`[generate] No agent config found for tenant "${d}", using defaults`),e={empathyEnabled:!0,allowDiscount:!1,maxDiscountAmount:0,signature:"",languageDefault:"nl"}}if(console.log("CONFIG USED IN GENERATE:",JSON.stringify({tenantId:d,...e})),!m&&!N)return E.NextResponse.json({error:"Missing subject/body"},{status:400});let D=`${m} ${N}`.toLowerCase();if(O.find(e=>D.includes(e))){let t=`Beste ${j||"klant"},

Wat vervelend om te horen dat uw product beschadigd is aangekomen. Onze excuses voor het ongemak.

We lossen dit direct voor u op:
- We sturen kosteloos een vervangend exemplaar naar u op.
- U hoeft het beschadigde product niet terug te sturen.
- U ontvangt binnen 24 uur een bevestiging met de verzendinformatie.

Mocht u nog vragen hebben, staat ons team voor u klaar.`;return e?.signature?.trim()&&(t=t+"\n\n--\n"+e.signature.trim()),console.log(`[generate] tenant=${d} route=AUTO_REPLY confidence=0.95`),await x(c,{tenantId:d,userId:n,requestId:i,source:g,subject:m,intent:"damage",confidence:.95,templateId:null,latencyMs:Date.now()-o,draftText:t,outcome:"auto_reply"}),await A(c,{tenantId:d,gmailMessageId:s,gmailThreadId:l,fromEmail:R,fromName:j,subject:m,bodyText:N,intent:"damage",confidence:.95,aiDraft:{subject:`Re: ${m}`,body:t,from:R}}),E.NextResponse.json({status:"AUTO_REPLY",confidence:.95,routing:"AUTO_REPLY",draft:{subject:`Re: ${m}`,body:t,from:R},knowledge:{used:!1,topSimilarity:null,sources:[]}})}let C=[],$=0;try{let e=await (0,y.createEmbedding)(`${m} ${N}`),{data:t,error:n}=await u.rpc("match_knowledge_chunks",{query_embedding:e,filter_client_id:d,match_threshold:.4,match_count:10});if(!n&&Array.isArray(t)&&t.length>0){$=t[0]?.similarity??0;let e=t.filter(e=>e.similarity>=.6),n=t.filter(e=>e.similarity>=.4&&e.similarity<.6);C=(e.length>0?e.slice(0,5):n.slice(0,5)).map(e=>({chunk:e.content,score:e.similarity,documentId:e.document_id,chunkId:e.id}))}n&&console.warn("[generate] knowledge retrieval failed:",n.message)}catch(e){console.warn("[generate] knowledge retrieval error:",e?.message)}let U=C.length>0,M=C.map(e=>e.chunk).join("\n\n---\n\n"),P=(p=await T(d),Y&&p.has(Y)?p.get(Y):p.has("fallback")?p.get("fallback"):null),G=P?.templateText??"Beantwoord het ticket professioneel en behulpzaam. Houd het beknopt en oplossingsgericht.",L=P?.id??null;console.log(`[generate] tenant=${d} intent=${Y} template=${L??"hardcoded_fallback"}`);let H=new v.default({apiKey:process.env.OPENAI_API_KEY}),q={subject:m,body:N,channel:r.channel,customer:r.customer,order:r.order},K=(f=e,t=f.empathyEnabled?"Toon gepaste empathie waar nodig, maar blijf feitelijk.":"Gebruik geen empathische zinnen. Houd het functioneel.",a=f.allowDiscount?`Kortingen zijn toegestaan tot maximaal €${f.maxDiscountAmount}. Ga nooit boven dit bedrag.`:"Kortingen zijn NIET toegestaan. Bied geen korting aan.",`
Je bent een AI customer support agent.

ROL:
Je behandelt support tickets professioneel en volgens bedrijfsbeleid.

GEDRAGSREGELS:
- ${t}
- ${a}
- Verzinnen van informatie is verboden.
- Als cruciale informatie ontbreekt: stel gerichte vragen of zet status op NEEDS_HUMAN.

HANDTEKENING – ABSOLUTE REGEL (NIET ONDERHANDELEN):
- Schrijf UITSLUITEND de inhoud van het e-mailbericht.
- Voeg GEEN afsluitende zin toe aan het einde van de body.
- Voeg GEEN handtekening toe.
- Gebruik NOOIT woorden zoals: "Met vriendelijke groet", "Kind regards", "Best regards", "Groeten", "Met groeten", of soortgelijke afsluitingen.
- Vermeld NIET de bedrijfsnaam onderaan.
- Vermeld NIET de teamnaam onderaan (zoals "Team Support", "Team SequenceFlow", etc.).
- Eindig de body direct na de laatste inhoudelijke zin, zonder extra witruimte of lege regels.
- De handtekening wordt automatisch door de server toegevoegd via tenant_agent_config.
- Als je toch een afsluiting toevoegt, is de output ongeldig.

BESLISLOGICA:
- Gebruik "DRAFT_OK" wanneer een correct antwoord mogelijk is.
- Gebruik "NEEDS_HUMAN" wanneer beleid onzeker is, informatie ontbreekt of risico bestaat.
- Stel confidence in:
  - 0.8 – 1.0 bij duidelijke, veilige cases
  - 0.4 – 0.7 bij ontbrekende informatie
  - 0.0 – 0.3 bij escalatie of onzekerheid

OUTPUT CONTRACT (ZEER BELANGRIJK – VOLG EXACT):
Je MOET uitsluitend geldige JSON teruggeven.
Geen markdown.
Geen uitleg.
Geen tekst v\xf3\xf3r of na de JSON.
Geen extra keys.

Het JSON schema MOET exact zijn:

{
  "status": "DRAFT_OK" | "NEEDS_HUMAN",
  "confidence": number,
  "intent": string,
  "draft": {
    "subject": string,
    "body": string
  },
  "actions": [],
  "reasons": []
}

INTENT CLASSIFICATIE:
Kies \xe9\xe9n intent die het beste past bij het bericht van de klant:
- "order_status"      — waar is mijn bestelling, track & trace
- "return_request"    — retour, terugsturen, ruilen
- "damaged"           — beschadigd, kapot, defect product
- "missing_items"     — artikel ontbreekt in pakket
- "complaint"         — klacht, ontevreden, slechte ervaring
- "warranty"          — garantie, defect na gebruik
- "cancellation"      — bestelling annuleren
- "payment"           — betaling, factuur, terugbetaling
- "shipping"          — verzending, levertijd, adreswijziging
- "product_question"  — vraag over product, maten, specificaties
- "compliment"        — compliment, positieve feedback
- "fallback"          — past in geen van bovenstaande categorie\xebn

REGELS:
- Gebruik NIET het veld "response".
- Gebruik NIET het veld "signature".
- Laat GEEN keys weg.
- confidence moet tussen 0 en 1 liggen.
- intent moet \xe9\xe9n van de bovenstaande waarden zijn.

VOORBEELD:

{
  "status": "DRAFT_OK",
  "confidence": 0.85,
  "intent": "order_status",
  "draft": {
    "subject": "Re: Order #1234 arrived damaged",
    "body": "Beste klant, bedankt voor uw bericht..."
  },
  "actions": [],
  "reasons": []
}
${G?`
ANTWOORD SJABLOON (BLAUWDRUK):
Gebruik het volgende sjabloon als basis voor de toon, structuur en inhoud van je antwoord. Pas de tekst aan op de situatie van de klant, maar wijk niet af van de stijl en het beleid.

${G}
`:""}
`),F=U?`${K}

Relevante interne kennis:
${M}`:K,z=(h=e,w=q.customer?.language??"nl",`
TAAL:
Antwoord in taal: ${w}

TICKET INPUT:
Subject: ${q.subject}
Body: ${q.body}

KLANT:
Naam: ${q.customer?.name??""}
Email: ${q.customer?.email??""}

ORDER:
OrderId: ${q.order?.orderId??""}
Product: ${q.order?.productName??""}
Betaald bedrag: ${q.order?.pricePaid??""} ${q.order?.currency??""}

HANDTEKENING (NIET IN JSON ZETTEN):
De server voegt automatisch toe:
${h.signature}
`),B=await H.chat.completions.create({model:"gpt-4.1-mini",messages:[{role:"system",content:F},{role:"user",content:z}],max_completion_tokens:600}),J=B.choices?.[0]?.message?.content;if(!J)throw Error("Model returned empty content.");let V=function(e){let t=e.trim().replace(/```json/gi,"").replace(/```/g,"").trim(),n=t.indexOf("{"),a=t.lastIndexOf("}");if(-1===n||-1===a)throw Error("No JSON found in model response.");return JSON.parse(t.slice(n,a+1))}(J),W=function(e){if(!e||"object"!=typeof e)throw Error("Invalid response: not an object.");if(!["DRAFT_OK","NEEDS_HUMAN"].includes(e.status))throw Error("Invalid response: status incorrect.");if("number"!=typeof e.confidence)throw Error("Invalid response: confidence must be number.");if(!e.draft||"object"!=typeof e.draft)throw Error("Invalid response: draft missing.");if("string"!=typeof e.draft.subject)throw Error("Invalid response: draft.subject missing.");if("string"!=typeof e.draft.body)throw Error("Invalid response: draft.body missing.");if(!Array.isArray(e.actions))throw Error("Invalid response: actions must be array.");if(!Array.isArray(e.reasons))throw Error("Invalid response: reasons must be array.");return e}(V),Y=(b=V.intent,_=String(b??"").trim().toLowerCase(),S.has(_)?_:"fallback");console.log(`[generate] tenant=${d} llmIntent=${Y}`);let X=I(W.confidence),Z=U?I(.6*$+.4*X):X,Q=Z<.6||"NEEDS_HUMAN"===W.status?"HUMAN_REVIEW":"AUTO";return e?.signature?.trim()&&(W.draft.body=W.draft.body.trim()+"\n\n--\n"+e.signature.trim()),e.allowDiscount||(W.actions=W.actions.filter(e=>"OFFER_DISCOUNT"!==e.type)),console.log(`[generate] tenant=${d} route=${Q} confidence=${Z.toFixed(2)} hasKnowledge=${U}`),await x(c,{tenantId:d,userId:n,requestId:i,source:g,subject:m,intent:Y,confidence:Z,templateId:L,latencyMs:Date.now()-o,draftText:W.draft.body,outcome:"AUTO"===Q?"auto":"human_review"}),await A(c,{tenantId:d,gmailMessageId:s,gmailThreadId:l,fromEmail:R,fromName:j,subject:m,bodyText:N,intent:Y,confidence:Z,aiDraft:{...W.draft,from:R}}),E.NextResponse.json({status:W.status,confidence:Z,routing:Q,draft:{...W.draft,from:R},knowledge:{used:U,topSimilarity:$||null,sources:C.map(e=>({documentId:e.documentId,chunkId:e.chunkId}))}})}catch(t){let e=String(t?.message??t);return await x(c,{tenantId:d,userId:n,requestId:i,source:g,subject:m,intent:null,confidence:null,templateId:null,latencyMs:Date.now()-o,draftText:null,outcome:"error"}),E.NextResponse.json({error:e},{status:500})}}e.s(["POST",()=>j,"runtime",0,"nodejs"],76284);var D=e.i(76284);let C=new t.AppRouteRouteModule({definition:{kind:n.RouteKind.APP_ROUTE,page:"/api/support/generate/route",pathname:"/api/support/generate",filename:"route",bundlePath:""},distDir:".next",relativeProjectDir:"",resolvedPagePath:"[project]/app/api/support/generate/route.ts",nextConfigOutput:"standalone",userland:D}),{workAsyncStorage:$,workUnitAsyncStorage:U,serverHooks:M}=C;function P(){return(0,a.patchFetch)({workAsyncStorage:$,workUnitAsyncStorage:U})}async function G(e,t,a){C.isDev&&(0,r.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let E="/api/support/generate/route";E=E.replace(/\/index$/,"")||"/";let w=await C.prepare(e,t,{srcPage:E,multiZoneDraftMode:!1});if(!w)return t.statusCode=400,t.end("Bad Request"),null==a.waitUntil||a.waitUntil.call(a,Promise.resolve()),null;let{buildId:v,params:y,nextConfig:_,parsedUrl:N,isDraftMode:R,prerenderManifest:k,routerServerContext:T,isOnDemandRevalidate:A,revalidateOnlyGenerated:x,resolvedPathname:I,clientReferenceManifest:O,serverActionsManifest:S}=w,j=(0,s.normalizeAppPath)(E),D=!!(k.dynamicRoutes[j]||k.routes[I]),$=async()=>((null==T?void 0:T.render404)?await T.render404(e,t,N,!1):t.end("This page could not be found"),null);if(D&&!R){let e=!!k.routes[I],t=k.dynamicRoutes[j];if(t&&!1===t.fallback&&!e){if(_.experimental.adapterPath)return await $();throw new h.NoFallbackError}}let U=null;!D||C.isDev||R||(U="/index"===(U=I)?"/":U);let M=!0===C.isDev||!D,P=D&&!M;S&&O&&(0,i.setManifestsSingleton)({page:E,clientReferenceManifest:O,serverActionsManifest:S});let G=e.method||"GET",L=(0,o.getTracer)(),H=L.getActiveScopeSpan(),q={params:y,prerenderManifest:k,renderOpts:{experimental:{authInterrupts:!!_.experimental.authInterrupts},cacheComponents:!!_.cacheComponents,supportsDynamicResponse:M,incrementalCache:(0,r.getRequestMeta)(e,"incrementalCache"),cacheLifeProfiles:_.cacheLife,waitUntil:a.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,n,a,r)=>C.onRequestError(e,t,a,r,T)},sharedContext:{buildId:v}},K=new l.NodeNextRequest(e),F=new l.NodeNextResponse(t),z=d.NextRequestAdapter.fromNodeNextRequest(K,(0,d.signalFromNodeResponse)(t));try{let i=async e=>C.handle(z,q).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let n=L.getRootSpanAttributes();if(!n)return;if(n.get("next.span_type")!==u.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${n.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let a=n.get("next.route");if(a){let t=`${G} ${a}`;e.setAttributes({"next.route":a,"http.route":a,"next.span_name":t}),e.updateName(t)}else e.updateName(`${G} ${E}`)}),s=!!(0,r.getRequestMeta)(e,"minimalMode"),l=async r=>{var o,l;let d=async({previousCacheEntry:n})=>{try{if(!s&&A&&x&&!n)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let o=await i(r);e.fetchMetrics=q.renderOpts.fetchMetrics;let l=q.renderOpts.pendingWaitUntil;l&&a.waitUntil&&(a.waitUntil(l),l=void 0);let d=q.renderOpts.collectedTags;if(!D)return await (0,g.sendResponse)(K,F,o,q.renderOpts.pendingWaitUntil),null;{let e=await o.blob(),t=(0,m.toNodeOutgoingHttpHeaders)(o.headers);d&&(t[f.NEXT_CACHE_TAGS_HEADER]=d),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let n=void 0!==q.renderOpts.collectedRevalidate&&!(q.renderOpts.collectedRevalidate>=f.INFINITE_CACHE)&&q.renderOpts.collectedRevalidate,a=void 0===q.renderOpts.collectedExpire||q.renderOpts.collectedExpire>=f.INFINITE_CACHE?void 0:q.renderOpts.collectedExpire;return{value:{kind:b.CachedRouteKind.APP_ROUTE,status:o.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:n,expire:a}}}}catch(t){throw(null==n?void 0:n.isStale)&&await C.onRequestError(e,t,{routerKind:"App Router",routePath:E,routeType:"route",revalidateReason:(0,c.getRevalidateReason)({isStaticGeneration:P,isOnDemandRevalidate:A})},!1,T),t}},u=await C.handleResponse({req:e,nextConfig:_,cacheKey:U,routeKind:n.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:k,isRoutePPREnabled:!1,isOnDemandRevalidate:A,revalidateOnlyGenerated:x,responseGenerator:d,waitUntil:a.waitUntil,isMinimalMode:s});if(!D)return null;if((null==u||null==(o=u.value)?void 0:o.kind)!==b.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==u||null==(l=u.value)?void 0:l.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});s||t.setHeader("x-nextjs-cache",A?"REVALIDATED":u.isMiss?"MISS":u.isStale?"STALE":"HIT"),R&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let h=(0,m.fromNodeOutgoingHttpHeaders)(u.value.headers);return s&&D||h.delete(f.NEXT_CACHE_TAGS_HEADER),!u.cacheControl||t.getHeader("Cache-Control")||h.get("Cache-Control")||h.set("Cache-Control",(0,p.getCacheControlHeader)(u.cacheControl)),await (0,g.sendResponse)(K,F,new Response(u.value.body,{headers:h,status:u.value.status||200})),null};H?await l(H):await L.withPropagatedContext(e.headers,()=>L.trace(u.BaseServerSpan.handleRequest,{spanName:`${G} ${E}`,kind:o.SpanKind.SERVER,attributes:{"http.method":G,"http.target":e.url}},l))}catch(t){if(t instanceof h.NoFallbackError||await C.onRequestError(e,t,{routerKind:"App Router",routePath:j,routeType:"route",revalidateReason:(0,c.getRevalidateReason)({isStaticGeneration:P,isOnDemandRevalidate:A})},!1,T),D)throw t;return await (0,g.sendResponse)(K,F,new Response(null,{status:500})),null}}e.s(["handler",()=>G,"patchFetch",()=>P,"routeModule",()=>C,"serverHooks",()=>M,"workAsyncStorage",()=>$,"workUnitAsyncStorage",()=>U],44101)}];

//# sourceMappingURL=%5Broot-of-the-server%5D__e90e1baa._.js.map