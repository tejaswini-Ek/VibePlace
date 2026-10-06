import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Link, Route, Switch, useLocation, useParams } from "wouter";
import {
  ArrowDownRight, ArrowLeft, ArrowRight, Bookmark, Check, ChevronDown, Clock3,
  Compass, Heart, Leaf, LogOut, MapPin, Menu, Search, Sparkles, Sun, Wind, X,
} from "lucide-react";
import {
  getGetCurrentUserQueryKey, getGetRecommendationsQueryKey, getGetWeatherQueryKey,
  getHealthCheckQueryKey, getListFavouritesQueryKey, getListSearchHistoryQueryKey,
  getSearchPlacesQueryKey, getSearchLocationsQueryKey,
  useAddFavourite, useGetCurrentUser, useGetRecommendations, useGetWeather, useHealthCheck,
  useListFavourites, useListSearchHistory, useLoginUser, useLogoutUser,
  useRegisterUser, useRemoveFavourite, useSaveSearchHistory, useSearchLocations,
  useSearchPlaces,
} from "@workspace/api-client-react";
import type { Place, SearchPlacesParams } from "@workspace/api-client-react";

const queryClient = new QueryClient();
const moods = [
  { id: "relax", title: "Slow it down", sub: "Quiet corners & calm", glyph: "01" },
  { id: "date", title: "Make it a moment", sub: "Somewhere to linger", glyph: "02" },
  { id: "party", title: "Bring the energy", sub: "A little more lively", glyph: "03" },
  { id: "work", title: "Find your focus", sub: "A good place to think", glyph: "04" },
  { id: "outdoor", title: "Get some air", sub: "A change of scenery", glyph: "05" },
  { id: "quick-bite", title: "Keep it moving", sub: "Something good, quickly", glyph: "06" },
];
const categories = ["Any kind of place", "cafe", "restaurant", "park", "bar", "bakery", "museum"];

function App() {
  return <QueryClientProvider client={queryClient}><div className="grain min-h-[100dvh]"><Switch>
    <Route path="/"><Shell><Home /></Shell></Route>
    <Route path="/places"><Shell><Results /></Shell></Route>
    <Route path="/place/:id"><Shell><PlaceDetail /></Shell></Route>
    <Route path="/login"><Shell><AuthPage mode="login" /></Shell></Route>
    <Route path="/register"><Shell><AuthPage mode="register" /></Shell></Route>
    <Route path="/favourites"><Shell><Favourites /></Shell></Route>
    <Route path="/profile"><Shell><Profile /></Shell></Route>
    <Route path="/search-history"><Shell><History /></Shell></Route>
    <Route><Shell><NotFound /></Shell></Route>
  </Switch></div></QueryClientProvider>;
}

function Shell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { data: user } = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey(), retry: false } });
  const health = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), retry: 1, staleTime: 60_000 } });
  const logout = useLogoutUser();
  const [, navigate] = useLocation();
  const links = [
    { href: "/", text: "Explore" }, { href: "/favourites", text: "Saved places" },
    { href: "/search-history", text: "Recent searches" },
  ];
  return <div className="min-h-[100dvh]">
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[76px] max-w-[1320px] items-center justify-between px-5 sm:px-8">
        <Link href="/" className="group flex items-center gap-3 rounded-xl focus-ring" data-testid="link-home">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground"><Compass size={20} strokeWidth={1.7}/></span>
          <span className="leading-none"><span className="serif block text-[20px] font-semibold tracking-[-.04em]">mood place</span><span className="mt-1 block text-[9px] font-semibold uppercase tracking-[.2em] text-muted-foreground">find your somewhere</span></span>
        </Link>
        <nav aria-label="Main navigation" className="hidden items-center gap-8 md:flex">
          {links.map(item => <Link key={item.href} href={item.href} className="text-[13px] font-semibold text-foreground/70 transition-colors hover:text-primary focus-ring" data-testid={`link-nav-${item.text.toLowerCase().replaceAll(" ","-")}`}>{item.text}</Link>)}
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          <span className="mr-1 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[.1em] text-muted-foreground" title={health.data?.status ?? "Checking place guide"}><span className={`h-1.5 w-1.5 rounded-full ${health.isError?"bg-[#c56852]":"bg-[#6d9977]"}`}/>{health.isLoading?"Checking":"Place guide"}</span>
          {user ? <><Link href="/profile" className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-sm font-semibold hover:border-primary/40" data-testid="link-profile"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#e9c1a9] font-bold text-[#4c4036]">{user.name.slice(0,1).toUpperCase()}</span>{user.name.split(" ")[0]}</Link><button aria-label="Sign out" className="rounded-full p-2 text-muted-foreground hover:bg-secondary" onClick={() => logout.mutate(undefined,{onSuccess:()=>{queryClient.setQueryData(getGetCurrentUserQueryKey(),undefined);navigate("/");}})} data-testid="button-logout"><LogOut size={17}/></button></> :
            <><Link href="/login" className="px-2 py-2 text-sm font-semibold hover:text-primary" data-testid="link-login">Sign in</Link><Link href="/register" className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 focus-ring" data-testid="link-register">Join for free</Link></>}
        </div>
        <button className="rounded-full p-2 md:hidden" aria-label="Open menu" aria-expanded={open} onClick={()=>setOpen(!open)} data-testid="button-menu">{open?<X/>:<Menu/>}</button>
      </div>
      {open && <nav className="border-t border-border bg-background p-4 md:hidden">
        {[...links, ...(user?[{href:"/profile",text:"My profile"}]:[{href:"/login",text:"Sign in"},{href:"/register",text:"Create account"}])].map(i=><Link key={i.href} href={i.href} onClick={()=>setOpen(false)} className="block rounded-xl px-4 py-3 font-semibold hover:bg-secondary">{i.text}</Link>)}
      </nav>}
    </header>
    <main className="page-enter">{children}</main>
    <footer className="mt-24 border-t border-border/70">
      <div className="mx-auto flex max-w-[1320px] flex-col gap-5 px-5 py-9 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p><span className="serif text-base font-semibold text-foreground">mood place</span><span className="mx-2">·</span>Good places for the way you feel.</p>
        <p>Places sourced from OpenStreetMap contributors.</p>
      </div>
    </footer>
  </div>;
}

function Home() {
  const [, navigate] = useLocation();
  const [location, setLocation] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [mood, setMood] = useState("relax");
  const [category, setCategory] = useState("Any kind of place");
  const query = location.trim();
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const account = useGetCurrentUser({
    query: { queryKey: getGetCurrentUserQueryKey(), retry: false },
  });
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 900);
    return () => window.clearTimeout(timer);
  }, [query]);
  const suggestionsQuery = useSearchLocations(
    { query: debouncedQuery.length >= 2 ? debouncedQuery : "  " },
    {
      query: {
        queryKey: getSearchLocationsQueryKey({ query: debouncedQuery }),
        enabled: debouncedQuery.length >= 2 && !selectedLocation,
        staleTime: 30_000,
      },
    },
  );
  const saveHistory = useSaveSearchHistory();
  const suggestions = suggestionsQuery.data ?? [];
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!query) return;
    const place = selectedLocation;
    const params = new URLSearchParams({location: place?.displayName ?? query,mood,category:category==="Any kind of place"?"":category});
    if (place) { params.set("latitude",String(place.latitude)); params.set("longitude",String(place.longitude)); }
    const data = {location:place?.displayName??query,category:category==="Any kind of place"?"all":category,mood,latitude:place?.latitude,longitude:place?.longitude};
    if (account.data) {
      saveHistory.mutate({data},{onError:(err:any)=>{
        sessionStorage.setItem("moodplace-history-warning",dbUnavailable(err)
          ?"Search history is temporarily unavailable while the database is being configured. This search was not saved."
          :"This search could not be added to your history.");
        window.dispatchEvent(new Event("moodplace-history-warning"));
      }});
    }
    navigate(`/places?${params.toString()}`);
  };
  return <div>
    <section className="relative overflow-hidden bg-[#e8eee4]">
      <div className="absolute -right-20 top-[-155px] h-[520px] w-[520px] rounded-full border border-[#c5d2c3]/70" aria-hidden="true"/>
      <div className="absolute right-[3%] top-[12%] hidden h-[390px] w-[390px] rounded-full bg-[#dce6d9] lg:block" aria-hidden="true"/>
      <div className="absolute right-[7%] top-[20%] hidden h-[350px] w-[350px] rounded-full border border-[#b8cbb9] lg:block" aria-hidden="true"/>
      <div className="absolute right-[15%] top-[31%] hidden h-[280px] w-[280px] rounded-full bg-[#c6d8c6] lg:block" aria-hidden="true"/>
      <div className="absolute right-[23%] top-[42%] hidden h-[184px] w-[184px] rounded-full bg-[#e6c9b5] shadow-[0_24px_80px_rgba(93,103,74,.12)] lg:block" aria-hidden="true"/>
      <div className="relative mx-auto grid max-w-[1320px] grid-cols-1 items-center gap-12 px-5 py-16 sm:px-8 sm:py-20 lg:min-h-[620px] lg:grid-cols-[1.04fr_.96fr] lg:py-20">
        <div className="max-w-[630px]">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#becfbd] bg-[#f4f5ec]/75 px-3.5 py-2 text-[11px] font-bold uppercase tracking-[.14em] text-[#41674f]"><Sparkles size={14}/> Your mood is a good place to start</div>
          <h1 className="serif max-w-[670px] text-[clamp(3.6rem,7vw,6.5rem)] leading-[.93] tracking-[-.065em] text-[#203c31]">Where does<br/><em className="font-medium text-[#678875]">today</em> take you?</h1>
          <p className="mt-6 max-w-[450px] text-[16px] leading-7 text-[#576c5e]">A little help finding the kind of place that fits the way you feel right now.</p>
          <form className="relative mt-9 max-w-[640px] rounded-[22px] border border-[#d4ddd1] bg-[#fbfbf6] p-2 shadow-[0_18px_48px_rgba(54,76,60,.13)]" onSubmit={submit}>
            <label htmlFor="place-location" className="sr-only">Your city or neighbourhood</label>
            <div className="flex items-center gap-3 px-3 pt-2">
              <MapPin className="shrink-0 text-primary" size={19}/>
              <input id="place-location" value={location} onChange={e=>{setLocation(e.target.value);setSelectedLocation(null);}} placeholder="City, neighbourhood, or postcode" autoComplete="off" className="h-11 w-full bg-transparent text-[15px] outline-none placeholder:text-[#99a39a]" data-testid="input-location"/>
              {location && <button type="button" onClick={()=>{setLocation("");setSelectedLocation(null);}} aria-label="Clear location" className="p-1 text-muted-foreground"><X size={16}/></button>}
            </div>
            {suggestions.length>0 && !selectedLocation && <div className="absolute left-2 right-2 top-[62px] z-30 overflow-hidden rounded-2xl border border-border bg-card p-1.5 shadow-xl">{suggestions.slice(0,5).map(s=><button type="button" key={s.id} onClick={()=>{setLocation(s.displayName);setSelectedLocation(s);}} className="flex w-full items-start gap-3 rounded-xl p-3 text-left hover:bg-secondary" data-testid={`suggestion-location-${s.id}`}><MapPin size={16} className="mt-1 text-primary"/><span><span className="block text-sm font-semibold">{s.name}</span><span className="mt-0.5 block text-xs text-muted-foreground">{s.displayName}</span></span></button>)}</div>}
            {suggestionsQuery.isLoading && query.length>=2 && <div className="absolute left-2 right-2 top-[62px] z-30 rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">Finding nearby places…</div>}
            <div className="mt-2 grid gap-2 border-t border-[#e4e8df] px-2 pt-3 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
              <label className="flex items-center gap-2 px-2 text-xs font-bold uppercase tracking-[.12em] text-[#758276]"><Wind size={14}/><span className="sr-only">Choose a mood</span><select value={mood} onChange={e=>setMood(e.target.value)} className="w-full cursor-pointer bg-transparent py-2 text-[13px] font-semibold normal-case tracking-normal text-[#2f5140] outline-none" data-testid="select-mood">{moods.map(m=><option value={m.id} key={m.id}>{m.title}</option>)}</select><ChevronDown size={13}/></label>
              <label className="flex items-center gap-2 border-l border-[#e4e8df] px-3 text-xs font-bold uppercase tracking-[.12em] text-[#758276]"><span className="sr-only">Choose a place type</span><select value={category} onChange={e=>setCategory(e.target.value)} className="w-full cursor-pointer bg-transparent py-2 text-[13px] font-semibold normal-case tracking-normal text-[#2f5140] outline-none" data-testid="select-category">{categories.map(c=><option key={c} value={c}>{c==="Any kind of place"?c:`${c[0].toUpperCase()}${c.slice(1)}s`}</option>)}</select><ChevronDown size={13}/></label>
              <button type="submit" disabled={!query} className="flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground transition-all hover:-translate-y-0.5 hover:bg-[#315d48] disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-find-places"><Search size={16}/> Find my place</button>
            </div>
          </form>
          <div className="mt-5 flex flex-wrap gap-2 text-xs text-[#64766a]"><span className="mr-1 py-2">Try a feeling</span>{moods.slice(0,4).map(m=><button key={m.id} onClick={()=>setMood(m.id)} className={`rounded-full border px-3 py-2 transition-colors ${mood===m.id?"border-primary/40 bg-primary/10 text-primary":"border-[#cbd8cb] hover:bg-white/60"}`} data-testid={`button-mood-${m.id}`}>{m.title}</button>)}</div>
        </div>
        <div className="relative hidden h-[460px] lg:block" aria-label="Abstract illustration of a city park and neighbourhood">
          <div className="absolute right-[3%] top-[4%] h-[390px] w-[390px] rounded-[46%_54%_65%_35%/43%_41%_59%_57%] bg-[#a6bea7] rotate-[-17deg]"/>
          <div className="absolute right-[2%] top-[8%] h-[390px] w-[390px] rounded-[46%_54%_65%_35%/43%_41%_59%_57%] border border-[#75967d] rotate-[-17deg]"/>
          <div className="absolute right-[18%] top-[20%] h-[320px] w-[295px] rounded-[42%_58%_38%_62%/49%_42%_58%_51%] bg-[#e0c1a9] rotate-[15deg]"/>
          <div className="absolute right-[32%] top-[28%] h-[245px] w-[235px] rounded-[46%_54%_61%_39%/51%_39%_61%_49%] bg-[#efead8] rotate-[-12deg]"/>
          <div className="absolute right-[29%] top-[16%] flex h-16 w-16 items-center justify-center rounded-full bg-[#426c53] text-[#f1eee0] shadow-xl"><MapPin size={24}/></div>
          <div className="absolute right-[1%] top-[58%] flex items-center gap-3 rounded-2xl border border-[#d7dfd4] bg-[#f7f6ee] px-4 py-3 shadow-lg"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e5c7b2] text-[#734e3c]"><Sun size={19}/></span><span><b className="block text-sm text-[#355244]">A little sunshine</b><small className="text-[#788378]">out there, waiting</small></span></div>
          <span className="serif absolute bottom-[9%] right-[18%] text-[15px] italic text-[#47634f]">your city, in a softer light</span>
        </div>
      </div>
    </section>
    <section className="mx-auto max-w-[1320px] px-5 py-20 sm:px-8 lg:py-24">
      <div className="mb-9 flex items-end justify-between gap-5"><div><p className="text-xs font-bold uppercase tracking-[.17em] text-primary">No two days are the same</p><h2 className="serif mt-3 text-4xl tracking-[-.04em] sm:text-5xl">What sounds good?</h2></div><p className="hidden max-w-[270px] pb-1 text-sm leading-6 text-muted-foreground sm:block">Pick a mood. We’ll find the neighbourhood places that meet it.</p></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{moods.map((m,i)=><button key={m.id} onClick={()=>{setMood(m.id);document.getElementById("place-location")?.focus();}} className={`group relative flex min-h-[142px] flex-col justify-between overflow-hidden rounded-[20px] border border-border/70 p-5 text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${i%3===1?"bg-[#f3e8de]":i%3===2?"bg-[#e7ece2]":"bg-[#f3f0e5]"}`} data-testid={`card-mood-${m.id}`}><span className="absolute right-4 top-1 serif text-[76px] leading-none text-[#466a51]/10 transition-transform group-hover:translate-y-1">{m.glyph}</span><span className="relative flex w-full items-start justify-between"><span className="serif text-[25px] leading-tight tracking-[-.03em] text-[#284a39]">{m.title}</span><ArrowDownRight size={19} className="text-[#698272] transition-transform group-hover:translate-x-1 group-hover:translate-y-1"/></span><span className="relative text-sm text-[#6b776e]">{m.sub}</span></button>)}</div>
    </section>
    <section className="mx-auto mb-6 max-w-[1320px] px-5 sm:px-8"><div className="relative overflow-hidden rounded-[28px] bg-[#2f5140] px-7 py-10 text-[#f5f1e5] sm:px-12 sm:py-12"><div className="absolute -right-10 -top-24 h-[300px] w-[300px] rounded-full border border-[#7d9981]/50"/><div className="absolute -right-1 top-[-70px] h-[220px] w-[220px] rounded-full border border-[#7d9981]/50"/><div className="relative flex flex-col justify-between gap-8 sm:flex-row sm:items-center"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#bdcfbc]">Your day, your way</p><h2 className="serif mt-3 max-w-[560px] text-3xl leading-tight tracking-[-.04em] sm:text-4xl">A small change of scene can change everything.</h2></div><Link href="/register" className="inline-flex w-fit items-center gap-2 rounded-full bg-[#e6c3a8] px-5 py-3 text-sm font-bold text-[#314b3b] transition-transform hover:-translate-y-0.5" data-testid="link-create-account">Save the places you love <ArrowRight size={16}/></Link></div></div></section>
  </div>;
}

function useSearchParamsFromUrl() {
  const [path] = useLocation();
  return useMemo(()=>new URLSearchParams(path.includes("?")?path.slice(path.indexOf("?")+1):""),[path]);
}
function Results() {
  const paramsUrl=useSearchParamsFromUrl();
  const location=paramsUrl.get("location")||"";
  const mood=paramsUrl.get("mood")||"relax";
  const category=paramsUrl.get("category")||undefined;
  const lat=Number(paramsUrl.get("latitude"));
  const lon=Number(paramsUrl.get("longitude"));
  const params: SearchPlacesParams={location,category,mood,latitude:Number.isFinite(lat)&&paramsUrl.has("latitude")?lat:undefined,longitude:Number.isFinite(lon)&&paramsUrl.has("longitude")?lon:undefined,page:1,pageSize:20,sort:"distance"};
  const queryKey=getSearchPlacesQueryKey(params);
  const result=useSearchPlaces(params,{query:{queryKey,enabled:!!location}});
  const recommendations=useGetRecommendations({location,mood:mood as any,latitude:params.latitude,longitude:params.longitude},{query:{queryKey:getGetRecommendationsQueryKey({location,mood:mood as any,latitude:params.latitude,longitude:params.longitude}),enabled:!!location}});
  const weather=useGetWeather({latitude:params.latitude??0,longitude:params.longitude??0},{query:{queryKey:getGetWeatherQueryKey({latitude:params.latitude??0,longitude:params.longitude??0}),enabled:params.latitude!==undefined&&params.longitude!==undefined}});
  const favs=useListFavourites({query:{queryKey:getListFavouritesQueryKey(),retry:false}});
  const add=useAddFavourite(),remove=useRemoveFavourite();
  const client=useQueryClient();
  const [notice,setNotice]=useState("");
  useEffect(()=>{const readWarning=()=>{const warning=sessionStorage.getItem("moodplace-history-warning");if(warning){setNotice(warning);sessionStorage.removeItem("moodplace-history-warning");}};readWarning();window.addEventListener("moodplace-history-warning",readWarning);return()=>window.removeEventListener("moodplace-history-warning",readWarning);},[]);
  const items=result.data?.items??[];
  const moodTitle=moods.find(m=>m.id===mood)?.title??"Find your mood";
  const isFav=(p:Place)=>favs.data?.some(f=>f.place.id===p.id);
  const toggle=(p:Place)=>{setNotice("");const onError=(e:any)=>setNotice(dbUnavailable(e)?"Saved places are temporarily unavailable while the place library is being configured. Nothing was saved.":"Sign in to keep a list of your saved places.");if(isFav(p))remove.mutate({placeId:p.id},{onSuccess:()=>client.invalidateQueries({queryKey:getListFavouritesQueryKey()}),onError});else add.mutate({data:placeInput(p)},{onSuccess:()=>client.invalidateQueries({queryKey:getListFavouritesQueryKey()}),onError});};
  const recommended=recommendations.data?.places??[];
  const ordered= recommended.length ? [...recommended,...items.filter(p=>!recommended.some(r=>r.id===p.id))] : items;
  return <div className="mx-auto max-w-[1320px] px-5 py-10 sm:px-8">
    <Link href="/" className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary"><ArrowLeft size={16}/>Change your search</Link>
    <div className="flex flex-col justify-between gap-5 border-b border-border pb-7 md:flex-row md:items-end"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">A good match for</p><h1 className="serif mt-2 text-4xl tracking-[-.04em] sm:text-5xl">{moodTitle}</h1><p className="mt-2 text-sm text-muted-foreground"><MapPin size={14} className="mr-1 inline"/>{location}{category?` · ${category}`:" · any kind of place"}</p></div><div className="flex flex-wrap items-center gap-2">{weather.data&&<span className="rounded-full bg-[#f4e8dd] px-3 py-2 text-xs font-semibold text-[#73503a]"><Sun size={14} className="mr-1 inline"/>{weather.data.temperatureC}° · {weather.data.condition}</span>}<span className="rounded-full bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground">{result.data?.total??0} places to explore</span></div></div>
    {recommendations.data?.weatherHint&&<div className="mt-5 rounded-xl border border-[#d3dfd2] bg-[#edf3ea] px-4 py-3 text-sm text-[#42654d]"><Sparkles size={15} className="mr-2 inline"/>{recommendations.data.weatherHint}</div>}
    {notice&&<div role="status" className="mt-5 rounded-xl border border-[#e2cbbb] bg-[#f8ede5] px-4 py-3 text-sm text-[#805339]">{notice}</div>}
    {result.isLoading?<div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{[0,1,2,3,4,5].map(n=><div key={n} className="h-[265px] animate-pulse rounded-[20px] bg-secondary/70"/> )}</div>
    :result.isError?<ErrorPanel message="We couldn’t reach the place guide just now." retry={()=>result.refetch()}/>
    :ordered.length===0?<EmptyState title="Nothing nearby yet" text="Try another neighbourhood or broaden the kind of place you’re after." action={<Link href="/" className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">Try a new search</Link>}/>
    :<div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{ordered.map((p,i)=><PlaceCard key={p.id} place={p} index={i} saved={!!isFav(p)} onSave={()=>toggle(p)} query={paramsUrl.toString()}/>)}</div>}
    <p className="mt-8 text-center text-xs leading-5 text-muted-foreground">Place data from OpenStreetMap contributors. Always check opening details with the venue.</p>
  </div>;
}

const cardArt=["bg-[#e7eadd]","bg-[#f1e1d5]","bg-[#e3e8de]","bg-[#e9e1d5]","bg-[#e5ebea]","bg-[#eee4d8]"];
function PlaceCard({place,index,saved,onSave,query}:{place:Place,index:number,saved:boolean,onSave:()=>void,query:string}) {
  const params = new URLSearchParams(query);
  return <article className="group overflow-hidden rounded-[22px] border border-border/80 bg-card transition-all duration-300 hover:-translate-y-1 hover:shadow-xl" data-testid={`card-place-${place.id}`}>
    <div className={`relative flex h-[150px] items-center justify-center overflow-hidden ${cardArt[index%cardArt.length]}`}>
      <div className="absolute -right-8 -top-16 h-48 w-48 rounded-full border border-[#58745d]/20"/>
      <div className="absolute right-5 top-4 h-32 w-32 rounded-full border border-[#58745d]/20"/>
      <span className="serif relative text-[80px] font-medium leading-none tracking-[-.08em] text-[#496c53]/35">{place.name.slice(0,1).toUpperCase()}</span>
      <span className="absolute left-4 top-4 rounded-full border border-white/60 bg-[#fbfaf4]/85 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.12em] text-[#48614d]">{place.category}</span>
      <button aria-label={saved?"Remove from saved places":"Save place"} onClick={onSave} className={`absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-white/50 transition-all ${saved?"bg-primary text-white":"bg-[#fbfaf4]/85 text-[#48614d] hover:bg-white"}`} data-testid={`button-favourite-${place.id}`}><Heart size={16} fill={saved?"currentColor":"none"}/></button>
    </div>
    <div className="p-5"><div className="flex items-start justify-between gap-3"><h2 className="serif text-[23px] leading-tight tracking-[-.025em]">{place.name}</h2>{place.distanceKm!=null&&<span className="mt-1 shrink-0 text-xs font-semibold text-muted-foreground">{place.distanceKm.toFixed(1)} km</span>}</div><p className="mt-2 min-h-[38px] text-sm leading-5 text-muted-foreground">{place.address || [place.city,place.state].filter(Boolean).join(", ") || "Address not listed"}</p><div className="mt-5 flex items-center justify-between border-t border-border/70 pt-4"><span className="text-xs text-muted-foreground"><MapPin size={13} className="mr-1 inline"/>{place.city||place.country||"Nearby"}</span><Link href={`/place/${encodeURIComponent(place.id)}?${params.toString()}`} className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:gap-2.5 transition-all" data-testid={`link-place-${place.id}`}>See place <ArrowRight size={15}/></Link></div></div>
  </article>;
}

function PlaceDetail() {
  const {id=""}=useParams();
  const search=useSearchParamsFromUrl();
  const params:SearchPlacesParams={location:search.get("location")||"",category:search.get("category")||undefined,mood:search.get("mood")||undefined,latitude:search.has("latitude")?Number(search.get("latitude")):undefined,longitude:search.has("longitude")?Number(search.get("longitude")):undefined,page:1,pageSize:50};
  const q=useSearchPlaces(params,{query:{queryKey:getSearchPlacesQueryKey(params),enabled:!!params.location}});
  const place=q.data?.items.find(p=>p.id===decodeURIComponent(id));
  const favs=useListFavourites({query:{queryKey:getListFavouritesQueryKey(),retry:false}});
  const add=useAddFavourite(),remove=useRemoveFavourite(),client=useQueryClient();
  const [message,setMessage]=useState("");
  if(q.isLoading)return <div className="mx-auto max-w-4xl px-5 py-20"><div className="h-80 animate-pulse rounded-3xl bg-secondary"/></div>;
  if(q.isError||!place)return <div className="mx-auto max-w-4xl px-5 py-20"><ErrorPanel message="We couldn’t find this place in your search." retry={()=>q.refetch()}/><Link href="/places" className="mt-5 inline-block text-primary">Back to places</Link></div>;
  const saved=favs.data?.some(f=>f.place.id===place.id);
  const onToggle=()=>{if(saved)remove.mutate({placeId:place.id},{onSuccess:()=>client.invalidateQueries({queryKey:getListFavouritesQueryKey()}),onError:(e:any)=>setMessage(dbUnavailable(e)?"Saved places are temporarily unavailable. Nothing was removed.":"Sign in to manage saved places.")});else add.mutate({data:placeInput(place)},{onSuccess:()=>client.invalidateQueries({queryKey:getListFavouritesQueryKey()}),onError:(e:any)=>setMessage(dbUnavailable(e)?"Saved places are temporarily unavailable. Nothing was saved.":"Sign in to save this place.")});};
  return <div className="mx-auto max-w-[1080px] px-5 py-10 sm:px-8">
    <Link href={`/places?${search.toString()}`} className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary"><ArrowLeft size={16}/>Back to your places</Link>
    <div className="mt-6 grid overflow-hidden rounded-[28px] border border-border bg-card md:grid-cols-[.85fr_1.15fr]">
      <div className="relative flex min-h-[290px] items-center justify-center overflow-hidden bg-[#e4ebdf] md:min-h-[520px]"><div className="absolute h-[340px] w-[340px] rounded-full border border-[#708c72]/30"/><div className="absolute h-[255px] w-[255px] rounded-full bg-[#d4dfd0]"/><span className="serif relative text-[150px] text-[#42684c]/40">{place.name[0]}</span><span className="absolute bottom-6 left-6 rounded-full bg-[#f8f6ed] px-4 py-2 text-xs font-bold uppercase tracking-[.12em] text-[#47604b]">{place.category}</span></div>
      <div className="flex flex-col justify-center p-7 sm:p-12"><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">A place for this moment</p><h1 className="serif mt-4 text-5xl leading-[1.02] tracking-[-.05em] sm:text-6xl">{place.name}</h1><p className="mt-5 flex items-start gap-2 text-[15px] leading-6 text-muted-foreground"><MapPin size={18} className="mt-1 shrink-0 text-primary"/>{place.address||[place.city,place.state,place.country].filter(Boolean).join(", ")}</p>{place.distanceKm!=null&&<p className="mt-2 text-sm text-muted-foreground">{place.distanceKm.toFixed(1)} km away</p>}
        {message&&<p role="status" className="mt-4 rounded-xl bg-[#f8ede5] p-3 text-sm text-[#805339]">{message}</p>}
        <div className="mt-8 flex flex-wrap gap-3"><button onClick={onToggle} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground hover:bg-[#315d48]" data-testid="button-save-place"><Heart size={16} fill={saved?"currentColor":"none"}/>{saved?"Saved to your places":"Save this place"}</button><a href={`https://www.openstreetmap.org/?mlat=${place.latitude}&mlon=${place.longitude}#map=17/${place.latitude}/${place.longitude}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-bold hover:bg-secondary" data-testid="link-open-map">Open map <ArrowUpRightIcon/></a></div>
        <p className="mt-8 border-t border-border pt-5 text-xs leading-5 text-muted-foreground">Place information from OpenStreetMap. Please confirm current hours and accessibility with the venue.</p>
      </div>
    </div>
  </div>;
}
function ArrowUpRightIcon(){return <ArrowRight size={15} className="-rotate-45"/>}
function placeInput(p:Place){return {id:p.id,name:p.name,category:p.category,address:p.address,city:p.city,country:p.country,state:p.state,latitude:p.latitude,longitude:p.longitude,externalId:p.externalId};}

function AuthPage({mode}:{mode:"login"|"register"}) {
  const login=mode==="login";
  const mutation=login?useLoginUser():useRegisterUser();
  const client=useQueryClient();const [,navigate]=useLocation();
  const [name,setName]=useState("");const [email,setEmail]=useState("");const [password,setPassword]=useState("");
  const [error,setError]=useState("");
  const submit=(e:FormEvent)=>{e.preventDefault();setError("");const options={onSuccess:(session:any)=>{client.setQueryData(getGetCurrentUserQueryKey(),session.user);navigate("/profile");},onError:(e:any)=>setError(dbUnavailable(e)?"Accounts are temporarily unavailable while the database is being configured. Your details were not saved.":messageFromError(e,login?"We couldn’t sign you in. Check your details and try again.":"We couldn’t create your account. Please try again."))};if(login)(mutation as ReturnType<typeof useLoginUser>).mutate({data:{email,password}},options);else(mutation as ReturnType<typeof useRegisterUser>).mutate({data:{name,email,password}},options);};
  return <div className="mx-auto grid max-w-[1120px] gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[1fr_.85fr] lg:items-center lg:py-20">
    <div className="relative min-h-[330px] overflow-hidden rounded-[28px] bg-[#e6ede2] p-8 sm:p-12"><div className="absolute -right-16 -top-14 h-[350px] w-[350px] rounded-full border border-[#9ab29a]/60"/><div className="absolute right-[12%] top-[14%] h-[260px] w-[260px] rounded-full bg-[#d0dfd0]"/><div className="absolute right-[27%] top-[30%] h-[160px] w-[160px] rounded-full bg-[#e9cbb3]"/><div className="relative max-w-[360px]"><span className="inline-flex items-center gap-2 rounded-full bg-[#f8f7ef] px-3 py-2 text-[11px] font-bold uppercase tracking-[.15em] text-primary"><Leaf size={14}/> An easier kind of going out</span><h1 className="serif mt-8 text-5xl leading-[1.03] tracking-[-.05em] text-[#254536] sm:text-6xl">{login?"Good to see you again.":"Keep the places that feel like you."}</h1><p className="mt-5 max-w-[310px] text-sm leading-6 text-[#65786a]">Save the little discoveries you’ll want to come back to.</p></div></div>
    <div className="mx-auto w-full max-w-[430px]"><Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary"><ArrowLeft size={15}/>Back to exploring</Link><h2 className="serif mt-7 text-4xl tracking-[-.04em]">{login?"Welcome back":"Make yourself at home"}</h2><p className="mt-2 text-sm text-muted-foreground">{login?"Sign in to pick up where you left off.":"A little account, a better list of places."}</p>
      <form className="mt-8 space-y-4" onSubmit={submit}>{!login&&<Field label="Your name" type="text" value={name} onChange={setName} placeholder="How should we call you?" test="input-name"/>}<Field label="Email address" type="email" value={email} onChange={setEmail} placeholder="you@example.com" test="input-email"/><Field label="Password" type="password" value={password} onChange={setPassword} placeholder={login?"Your password":"At least 8 characters"} test="input-password"/>{error&&<p role="alert" className="rounded-xl border border-[#e6cbbd] bg-[#fbefe7] px-4 py-3 text-sm text-[#8b4f38]" data-testid="text-auth-error">{error}</p>}<button disabled={mutation.isPending} className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-bold text-primary-foreground transition-all hover:bg-[#315d48] disabled:opacity-60" data-testid="button-auth-submit">{mutation.isPending?"One moment…":login?"Sign in":"Create my account"}<ArrowRight size={16}/></button></form>
      <p className="mt-6 text-center text-sm text-muted-foreground">{login?"New around here?":"Already have an account?"} <Link href={login?"/register":"/login"} className="font-bold text-primary hover:underline" data-testid="link-auth-switch">{login?"Create an account":"Sign in"}</Link></p>
      <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">Accounts may be temporarily unavailable while the place library is being configured. Your details are only saved when sign-up succeeds.</p>
    </div>
  </div>;
}
function Field({label,type,value,onChange,placeholder,test}:{label:string,type:string,value:string,onChange:(s:string)=>void,placeholder:string,test:string}){return <label className="block"><span className="mb-2 block text-sm font-semibold">{label}</span><input required type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} minLength={type==="password"?8:undefined} className="h-12 w-full rounded-xl border border-border bg-card px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" data-testid={test}/></label>}

function Favourites() {
  const {data:user}=useGetCurrentUser({query:{queryKey:getGetCurrentUserQueryKey(),retry:false}});
  const favs=useListFavourites({query:{queryKey:getListFavouritesQueryKey(),retry:false}});
  const remove=useRemoveFavourite(),client=useQueryClient();const [error,setError]=useState("");
  if(favs.isLoading)return <PageLoading title="Your saved places"/>;
  if(favs.isError)return <div className="mx-auto max-w-[1100px] px-5 py-14"><PageHeading eyebrow="Your little list" title="Saved places" text="The places you’ve bookmarked for another day."/><div className="my-8 rounded-[22px] border border-[#e2d3ba] bg-[#f6f0e3] p-6"><h2 className="serif text-2xl">{dbUnavailable(favs.error)?"Saved places are taking a little pause.":"Sign in to see your list."}</h2><p className="mt-2 text-sm leading-6 text-[#735f45]">{dbUnavailable(favs.error)?"Saved places are temporarily unavailable while the database is being configured. Nothing has been changed.":"Your favourites are attached to your account, so they’ll be here when you sign in."}</p><div className="mt-4 flex gap-3"><Link href="/login" className="rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Sign in</Link><button onClick={()=>favs.refetch()} className="rounded-full border border-[#d7c7ae] px-4 py-2.5 text-sm font-semibold">Try again</button></div></div></div>;
  return <div className="mx-auto max-w-[1100px] px-5 py-14 sm:px-8"><PageHeading eyebrow="Your little list" title="Saved places" text={user?`Places worth coming back to, ${user.name.split(" ")[0]}.`:"A pocket-sized list of somewhere good."}/>{error&&<p role="status" className="mb-5 rounded-xl bg-[#fbefe7] p-3 text-sm text-[#8b4f38]">{error}</p>}
  {!user&&<div className="mb-6 rounded-2xl border border-[#e2d3ba] bg-[#f6f0e3] p-4 text-sm text-[#735f45]">Sign in to see and manage places saved to your account. <Link href="/login" className="ml-1 font-bold underline">Sign in</Link></div>}
  {!favs.data?.length?<EmptyState title="A list with room to grow" text="When a place catches your eye, tap the heart to save it for later." action={<Link href="/" className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">Find a place</Link>}/>:<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{favs.data.map((f,i)=><div key={f.id} className="relative"><PlaceCard place={f.place} index={i} saved onSave={()=>remove.mutate({placeId:f.place.id},{onSuccess:()=>client.invalidateQueries({queryKey:getListFavouritesQueryKey()}),onError:(e:any)=>setError(dbUnavailable(e)?"Saved places are unavailable right now. Nothing was removed.":"Couldn’t remove this place.")})} query=""/></div>)}</div>}</div>;
}
function Profile(){const q=useGetCurrentUser({query:{queryKey:getGetCurrentUserQueryKey(),retry:false}});const logout=useLogoutUser();const [,navigate]=useLocation();if(q.isLoading)return <PageLoading title="Your profile"/>;if(q.isError||!q.data)return <div className="mx-auto max-w-[900px] px-5 py-16"><PageHeading eyebrow="Your corner" title="Your profile" text="Sign in to see your account details."/><Link href="/login" className="mt-8 inline-flex rounded-full bg-primary px-5 py-3 font-semibold text-primary-foreground">Sign in</Link></div>;const user=q.data;return <div className="mx-auto max-w-[900px] px-5 py-14 sm:px-8"><PageHeading eyebrow="Your corner" title={`Hello, ${user.name.split(" ")[0]}.`} text="A little home base for all your good-place finding."/><div className="mt-9 rounded-[24px] border border-border bg-card p-6 sm:p-9"><div className="flex items-center gap-4 border-b border-border pb-6"><span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#e8ccb8] serif text-3xl text-[#654b3a]">{user.name[0].toUpperCase()}</span><div><h2 className="serif text-2xl">{user.name}</h2><p className="text-sm text-muted-foreground">{user.email}</p></div></div><div className="grid gap-5 py-6 sm:grid-cols-2"><Info label="Member since" value={new Date(user.createdAt).toLocaleDateString(undefined,{month:"long",year:"numeric"})}/><Info label="Email address" value={user.email}/></div><div className="flex flex-wrap gap-3"><Link href="/favourites" className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold hover:bg-secondary">Your saved places</Link><Link href="/search-history" className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold hover:bg-secondary">Recent searches</Link><button onClick={()=>logout.mutate(undefined,{onSuccess:()=>{queryClient.setQueryData(getGetCurrentUserQueryKey(),undefined);navigate("/");}})} className="ml-auto inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-secondary"><LogOut size={15}/>Sign out</button></div></div></div>}
function Info({label,value}:{label:string,value:string}){return <div><p className="text-xs font-bold uppercase tracking-[.13em] text-muted-foreground">{label}</p><p className="mt-2 text-sm font-semibold">{value}</p></div>}

function History(){const q=useListSearchHistory({limit:30},{query:{queryKey:getListSearchHistoryQueryKey({limit:30}),retry:false}});if(q.isLoading)return <PageLoading title="Recent searches"/>;if(q.isError)return <div className="mx-auto max-w-[1000px] px-5 py-14"><PageHeading eyebrow="A path you’ve taken" title="Recent searches" text="Your latest neighbourhood explorations."/><div className="my-8 rounded-[22px] border border-[#e2d3ba] bg-[#f6f0e3] p-6"><h2 className="serif text-2xl">{dbUnavailable(q.error)?"History is taking a little pause.":"Your recent searches live with your account."}</h2><p className="mt-2 text-sm leading-6 text-[#735f45]">{dbUnavailable(q.error)?"Search history is temporarily unavailable while the database is being configured. Searches have not been saved.":"Sign in to revisit your recent neighbourhood searches."}</p><div className="mt-4 flex gap-3"><Link href="/login" className="rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Sign in</Link><button onClick={()=>q.refetch()} className="rounded-full border border-[#d7c7ae] px-4 py-2.5 text-sm font-semibold">Try again</button></div></div></div>;
  return <div className="mx-auto max-w-[1000px] px-5 py-14 sm:px-8"><PageHeading eyebrow="A path you’ve taken" title="Recent searches" text="Your latest neighbourhood explorations."/>
    {!q.data?.length?<EmptyState title="Every good search starts somewhere" text="Your searches will show up here when you’re signed in and history is available." action={<Link href="/" className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">Start exploring</Link>}/>:<div className="mt-8 overflow-hidden rounded-[22px] border border-border bg-card">{q.data.map((entry,i)=><Link key={entry.id} href={`/places?${new URLSearchParams({location:entry.location,mood:entry.mood??"relax",category:entry.category==="all"?"":entry.category,...(entry.latitude!=null?{latitude:String(entry.latitude)}:{}),...(entry.longitude!=null?{longitude:String(entry.longitude)}:{})}).toString()}`} className="group flex flex-col gap-3 border-b border-border/70 p-5 last:border-0 hover:bg-[#f6f4eb] sm:flex-row sm:items-center sm:justify-between" data-testid={`link-history-${entry.id}`}><div className="flex items-center gap-4"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#e7eee4] text-primary"><Clock3 size={18}/></span><span><b className="block text-[15px]">{entry.location}</b><span className="mt-1 block text-xs text-muted-foreground">{entry.category==="all"?"All places":entry.category}{entry.mood?` · ${moods.find(m=>m.id===entry.mood)?.title??entry.mood}`:""}</span></span></div><span className="flex items-center gap-3 pl-[60px] text-xs text-muted-foreground sm:pl-0">{new Date(entry.createdAt).toLocaleDateString(undefined,{month:"short",day:"numeric"})}<span className="inline-flex items-center gap-1 font-bold text-primary opacity-0 transition-opacity group-hover:opacity-100">Search again <ArrowRight size={14}/></span></span></Link>)}</div>}
  </div>;
}

function PageHeading({eyebrow,title,text}:{eyebrow:string,title:string,text:string}){return <div><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">{eyebrow}</p><h1 className="serif mt-3 text-4xl tracking-[-.05em] sm:text-5xl">{title}</h1><p className="mt-3 max-w-[520px] text-sm leading-6 text-muted-foreground">{text}</p></div>}
function PageLoading({title}:{title:string}){return <div className="mx-auto max-w-[1000px] px-5 py-14"><p className="serif text-3xl">{title}</p><div className="mt-7 h-40 animate-pulse rounded-[22px] bg-secondary"/></div>}
function EmptyState({title,text,action}:{title:string,text:string,action?:ReactNode}){return <div className="my-10 flex min-h-[290px] flex-col items-center justify-center rounded-[24px] border border-dashed border-[#c8d4c6] bg-[#f0f2e9] px-6 text-center"><span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#dfe8dc] text-primary"><Leaf size={24}/></span><h2 className="serif mt-5 text-2xl tracking-[-.03em]">{title}</h2><p className="mt-2 max-w-[400px] text-sm leading-6 text-muted-foreground">{text}</p>{action&&<div className="mt-5">{action}</div>}</div>}
function ErrorPanel({message,retry}:{message:string,retry:()=>void}){return <div role="alert" className="my-8 rounded-[22px] border border-[#e5cabb] bg-[#fbf0e8] p-6"><p className="font-semibold text-[#734c3d]">{message}</p><p className="mt-1 text-sm text-[#8e6958]">Your search is still here. Give it another try.</p><button onClick={retry} className="mt-4 rounded-full bg-[#8b5842] px-4 py-2 text-sm font-semibold text-white hover:bg-[#754733]" data-testid="button-retry">Try again</button></div>}
function NotFound(){return <div className="mx-auto max-w-[760px] px-5 py-24 text-center"><span className="text-xs font-bold uppercase tracking-[.16em] text-primary">A little detour</span><h1 className="serif mt-4 text-6xl tracking-[-.06em]">This place is a mystery.</h1><p className="mt-4 text-muted-foreground">Let’s find you somewhere that’s actually on the map.</p><Link href="/" className="mt-7 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"><ArrowLeft size={16}/>Back to exploring</Link></div>}
function dbUnavailable(err:any){const msg=messageFromError(err,"").toLowerCase();return ["database","mongodb","mongo","not configured","unavailable","503"].some(t=>msg.includes(t));}
function messageFromError(err:any,fallback:string){return err?.data?.error??err?.message??fallback;}

export default App;
