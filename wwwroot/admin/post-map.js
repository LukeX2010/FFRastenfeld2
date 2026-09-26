// Hash exactly the JSON supplied by the API, before constructing the edit draft.
export async function postToDraft(post) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(post)));
  const basePostHash = Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
  return { id:crypto.randomUUID(),postId:post.Id,basePostHash,slug:post.Slug,titel:post.Titel||'',kategorie:post.Kategorie,datum:post.Datum.slice(0,10),ort:post.EinsatzOrt||'',einsatzTyp:post.EinsatzTyp||'',einsatzZeit:post.EinsatzZeit||'',einsatzKraefte:post.EinsatzKraefte??null,kurztext:post.Kurztext||'',volltext:post.Volltext||'',notizen:'',kiAnweisung:'',bilder:(post.Bilder||[]).map((b,i)=>({id:`existing-${i}`,name:`Bild ${i+1}`,path:typeof b==='string'?b:b.Pfad,caption:typeof b==='string'?'':b.Beschreibung||'',isTitleImage:i===0,isInformationOnly:false})) };
}
