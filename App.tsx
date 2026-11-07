import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useState } from 'react';
import { ImageBackground, Linking, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, Pressable, View } from 'react-native';
import { categories, daysUntil, defaultPreferences, money, opportunityAlerts, rankExperiences, type Category, type Experience, type Feedback, type Preferences } from './src/logic';
import { catalog } from './src/catalog';
import { interpretIntent, recommendForIntent, type DiscoveryMode } from './src/agent';
import { askRemoteScout, pickToExperience, remoteScoutConfigured } from './src/remoteScout';

type Tab = 'Discover' | 'Now' | 'Along the Way' | 'Saved' | 'You';
type StoredState = { preferences: Preferences; feedback: Feedback; savedIds: string[]; setupComplete: boolean };
const STORAGE_KEY = 'pbb-local-state-v1';
const tabs: Tab[] = ['Discover', 'Now', 'Along the Way', 'Saved', 'You'];
const ink = '#182C3B';
const muted = '#60727B';
const sea = '#1C6973';

function Pill({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.pill, active && styles.pillActive]}><Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text></Pressable>;
}

function Action({ label, onPress, secondary, small }: { label: string; onPress: () => void; secondary?: boolean; small?: boolean }) {
  return <Pressable onPress={onPress} style={[styles.action, secondary && styles.actionSecondary, small && styles.actionSmall]}><Text style={[styles.actionText, secondary && styles.actionTextSecondary]}>{label}</Text></Pressable>;
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function Card({ item, saved, loved, onOpen, onSave, onLove, onPass }: { item: Experience; saved: boolean; loved: boolean; onOpen: () => void; onSave: () => void; onLove: () => void; onPass: () => void }) {
  return <View style={styles.card}>
    <View style={[styles.cardArt, { backgroundColor: item.accent }]}><Text style={styles.artGlyph}>{item.category === 'Dance' ? '✦' : item.category === 'Outdoors' ? '◒' : item.category === 'Arts' ? '✳' : item.category === 'Food' ? '◌' : item.category === 'Learning' ? '✧' : '☼'}</Text><Text style={styles.artLabel}>{item.category.toUpperCase()}</Text></View>
    <View style={styles.cardBody}>
      <View style={styles.rowBetween}><Text style={styles.eyebrow}>{item.mode === 'live' ? 'Source checked' : 'Sample'} · {item.format} · {formatDate(item.startsAt)}</Text><Text style={styles.cost}>{money(item.totalCost, item.currency)}</Text></View>
      <Text style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.cardMeta}>{item.location} · {item.distanceKm} km · {item.durationHours} hr</Text>
      <Text style={styles.summary} numberOfLines={2}>{item.summary}</Text>
      <View style={styles.cardActions}>
        <Action label="Explore" onPress={onOpen} small />
        {item.mode === 'live' && item.sourceUrl?.startsWith('https://') ? <Action label="Source ↗" onPress={() => Linking.openURL(item.sourceUrl!)} secondary small /> : null}
        <Action label={saved ? 'Saved ✓' : 'Save'} onPress={onSave} secondary small />
        <Pressable onPress={onLove} style={styles.textAction}><Text style={styles.textActionLabel}>{loved ? 'Loved ✓' : 'Love'}</Text></Pressable>
        <Pressable onPress={onPass} style={styles.textAction}><Text style={styles.textActionLabel}>Pass</Text></Pressable>
      </View>
    </View>
  </View>;
}

export default function App() {
  const [tab, setTab] = useState<Tab>('Discover');
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);
  const [feedback, setFeedback] = useState<Feedback>({});
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);
  const [lastPassed, setLastPassed] = useState<{ item: Experience; wasSaved: boolean } | null>(null);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [selected, setSelected] = useState<Experience | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | 'All'>('All');
  const [showDiverse, setShowDiverse] = useState(false);
  const [timeHours, setTimeHours] = useState(2);
  const [destination, setDestination] = useState('');
  const [agentPrompt, setAgentPrompt] = useState('');
  const [activeRequest, setActiveRequest] = useState<string | null>(null);
  const [agentMode, setAgentMode] = useState<DiscoveryMode>('balanced');
  const [remoteSuggestions, setRemoteSuggestions] = useState<{ item: Experience; reason: string }[]>([]);
  const [remoteItems, setRemoteItems] = useState<Experience[]>([]);
  const [scoutLoading, setScoutLoading] = useState(false);
  const [scoutMessage, setScoutMessage] = useState('');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) {
        const saved = JSON.parse(raw) as Partial<StoredState>;
        if (saved.preferences) setPreferences({ ...defaultPreferences, ...saved.preferences, place: saved.preferences.place || 'Toronto, Canada' });
        if (saved.feedback) setFeedback(saved.feedback);
        if (saved.savedIds) setSavedIds(saved.savedIds);
        if (saved.setupComplete) setSetupComplete(true);
      }
    }).catch(() => {}).finally(() => setHydrated(true));
  }, []);
  useEffect(() => {
    if (hydrated) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ preferences, feedback, savedIds, setupComplete })).catch(() => {});
  }, [preferences, feedback, savedIds, setupComplete, hydrated]);
  useEffect(() => {
    catalog.load().then(result => setExperiences(result.items)).catch(() => setExperiences([])).finally(() => setCatalogLoading(false));
  }, []);
  useEffect(() => { setRemoteSuggestions([]); setRemoteItems([]); setActiveRequest(null); }, [preferences.place, preferences.currency]);

  const showingTorontoSamples = /^toronto(?:\b|,)/i.test(preferences.place.trim()) && preferences.currency === 'CAD';
  const localExamples = useMemo(() => showingTorontoSamples ? experiences : [], [experiences, showingTorontoSamples]);
  const allItems = useMemo(() => [...remoteItems, ...localExamples.filter(item => !remoteItems.some(remote => remote.id === item.id))], [remoteItems, localExamples]);
  const ranked = useMemo(() => rankExperiences(allItems, preferences, feedback, savedIds), [allItems, preferences, feedback, savedIds]);
  const alerts = useMemo(() => opportunityAlerts(allItems, preferences, feedback, savedIds), [allItems, preferences, feedback, savedIds]);
  const agentSuggestions = useMemo(() => remoteScoutConfigured ? remoteSuggestions.map(suggestion => ({ item: suggestion.item, reasons: [suggestion.reason] })) : activeRequest === null ? [] : recommendForIntent(localExamples, preferences, feedback, savedIds, interpretIntent(activeRequest), agentMode).slice(0, 3), [localExamples, preferences, feedback, savedIds, activeRequest, agentMode, remoteSuggestions]);
  const visible = ranked.filter(item => (category === 'All' || item.category === category) && (!query || `${item.title} ${item.category} ${item.tags.join(' ')} ${item.location}`.toLowerCase().includes(query.toLowerCase())));
  const diverse = showDiverse ? [...visible].sort((a, b) => Number(preferences.interests.includes(a.category)) - Number(preferences.interests.includes(b.category))) : visible;
  const toggleSaved = (id: string) => setSavedIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const toggleInterest = (value: Category) => setPreferences(current => ({ ...current, interests: current.interests.includes(value) ? current.interests.filter(item => item !== value) : [...current.interests, value] }));
  const setNumber = (key: 'maxBudget' | 'maxDistanceKm', value: string) => {
    const number = Number(value.replace(/[^0-9]/g, ''));
    setPreferences(current => ({ ...current, [key]: Number.isFinite(number) ? number : 0 }));
  };
  const runScout = async (prompt: string, refinement: DiscoveryMode = 'balanced') => {
    setActiveRequest(prompt);
    setAgentMode(refinement);
    setScoutMessage('');
    if (!remoteScoutConfigured) return;
    if (!preferences.place.trim() || !/^[A-Z]{3}$/.test(preferences.currency)) { setScoutMessage('Enter a city, country, and three-letter currency in You first.'); return; }
    setScoutLoading(true);
    try {
      const result = await askRemoteScout(prompt, preferences, refinement);
      const suggestions = result.picks.map(pick => ({ item: pickToExperience(pick), reason: pick.reason }));
      setRemoteSuggestions(suggestions);
      setRemoteItems(current => [...suggestions.map(suggestion => suggestion.item), ...current.filter(item => !suggestions.some(suggestion => suggestion.item.id === item.id))]);
      setScoutMessage(result.message);
    } catch (error) {
      setRemoteSuggestions([]);
      setScoutMessage(error instanceof Error ? `The scout is unavailable: ${error.message}` : 'The scout is unavailable. Please try again.');
    } finally { setScoutLoading(false); }
  };
  const itemCard = (item: Experience) => <Card key={item.id} item={item} saved={savedIds.includes(item.id)} loved={feedback[item.id] === 'love'} onOpen={() => setSelected(item)} onSave={() => toggleSaved(item.id)} onLove={() => setFeedback(current => { const next = { ...current }; if (next[item.id] === 'love') delete next[item.id]; else next[item.id] = 'love'; return next; })} onPass={() => { setFeedback(current => ({ ...current, [item.id]: 'pass' })); setSavedIds(current => current.filter(id => id !== item.id)); setLastPassed({ item, wasSaved: savedIds.includes(item.id) }); }} />;
  const undoPass = () => {
    if (!lastPassed) return;
    setFeedback(current => { const next = { ...current }; delete next[lastPassed.item.id]; return next; });
    if (lastPassed.wasSaved) setSavedIds(current => current.includes(lastPassed.item.id) ? current : [...current, lastPassed.item.id]);
    setLastPassed(null);
  };

  if (!hydrated) return <SafeAreaView style={styles.safe}><View style={styles.loading}><Text style={styles.brand}>PB&B ✦</Text><Text style={styles.lead}>Getting your ideas ready…</Text></View></SafeAreaView>;
  if (!setupComplete) return <SafeAreaView style={styles.safe}><StatusBar style="dark" /><ScrollView contentContainerStyle={styles.welcome}>
    <Text style={styles.sectionKicker}>WELCOME TO PB&B</Text><Text style={styles.welcomeTitle}>A little more wonder, close to home.</Text>
    <Text style={styles.lead}>Tell us what catches your eye. You can change everything later.</Text>
    <Text style={styles.subheading}>Where should we look?</Text><TextInput value={preferences.place} onChangeText={place => setPreferences(current => ({ ...current, place }))} placeholder="City and country, e.g. Paris, France" placeholderTextColor="#8A9AA1" style={styles.search} />
    <Text style={styles.label}>Budget currency · three-letter code</Text><TextInput value={preferences.currency} onChangeText={currency => setPreferences(current => ({ ...current, currency: currency.replace(/[^a-z]/gi, '').slice(0, 3).toUpperCase() }))} placeholder="e.g. EUR, JPY, BRL" autoCapitalize="characters" maxLength={3} style={styles.search} />
    <Text style={styles.subheading}>What would you like to explore?</Text><View style={styles.chipRow}>{categories.map(value => <Pill key={value} label={value} active={preferences.interests.includes(value)} onPress={() => toggleInterest(value)} />)}</View>
    <Text style={styles.subheading}>What works for most outings?</Text><Text style={styles.label}>Maximum budget · {preferences.currency}</Text><View style={styles.chipRow}>{[0, 25, 50, 100, 200].map(value => <Pill key={value} label={value === 0 ? 'Free' : `${value} ${preferences.currency}`} active={preferences.maxBudget === value} onPress={() => setPreferences(current => ({ ...current, maxBudget: value }))} />)}</View>
    <Text style={styles.label}>Travel radius from your chosen place</Text><View style={styles.chipRow}>{[5, 15, 30, 60].map(value => <Pill key={value} label={`${value} km`} active={preferences.maxDistanceKm === value} onPress={() => setPreferences(current => ({ ...current, maxDistanceKm: value }))} />)}</View>
    <Setting label="Show timely in-app finds" value={preferences.alertsEnabled} onPress={() => setPreferences(current => ({ ...current, alertsEnabled: !current.alertsEnabled }))} />
    <Text style={styles.notice}>Check an activity's official source before travelling. Times, costs, availability, weather and closures can change; PB&B and AI can make mistakes. This preview contains Toronto examples only.</Text>
    {preferences.interests.length && preferences.place.trim().length >= 3 && /^[A-Z]{3}$/.test(preferences.currency) ? <Action label="Start exploring" onPress={() => setSetupComplete(true)} /> : <Text style={styles.helper}>Choose an interest, enter a city and country, and use a three-letter currency code to continue.</Text>}
  </ScrollView></SafeAreaView>;

  return <SafeAreaView style={styles.safe}><StatusBar style="dark" />
    <View style={styles.header}><View><Text style={styles.brand}>PB&B <Text style={styles.brandStar}>✦</Text></Text><Text style={styles.brandSub}>Exploring {preferences.place || 'anywhere'}</Text></View><Pressable onPress={() => setTab('You')} style={styles.avatar}><Text style={styles.avatarText}>YOU</Text></Pressable></View>
    <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} keyboardShouldPersistTaps="handled">
      {!selected && lastPassed && <View style={styles.undoBanner}><Text style={styles.undoText}>Passed on {lastPassed.item.title}</Text><Pressable onPress={undoPass}><Text style={styles.undoLink}>Undo</Text></Pressable></View>}
      {selected ? <View>
        <Pressable onPress={() => setSelected(null)}><Text style={styles.back}>‹ Back to exploring</Text></Pressable>
        <View style={[styles.detailArt, { backgroundColor: selected.accent }]}><Text style={styles.detailGlyph}>✦</Text><Text style={styles.detailCategory}>{selected.category.toUpperCase()}</Text></View>
        <Text style={styles.eyebrow}>{selected.format} · {formatDate(selected.startsAt)}</Text>
        <Text style={styles.h1}>{selected.title}</Text><Text style={styles.lead}>{selected.summary}</Text>
        <View style={styles.infoPanel}><Text style={styles.infoText}>⌖  {selected.location} · about {selected.distanceKm} km from {preferences.place}</Text><Text style={styles.infoText}>◷  Starts {formatDate(selected.startsAt)} · {selected.durationHours} hours</Text><Text style={styles.infoText}>$  {money(selected.totalCost, selected.currency)} listed cost</Text></View>
        <Text style={styles.notice}>Before leaving, confirm the date, time, price, availability, weather policy and location with the organizer. Activities can fill, sell out, close or change without notice. PB&B and AI can make mistakes.</Text>
        {selected.mode === 'live' && selected.sourceUrl?.startsWith('https://') ? <Action label="Check the listing source ↗" onPress={() => Linking.openURL(selected.sourceUrl!)} /> : <Text style={styles.notice}>This is a sample idea without a verified source or booking link.</Text>}
        <Action label={savedIds.includes(selected.id) ? 'Remove from saved' : 'Save for later'} onPress={() => toggleSaved(selected.id)} />
      </View> : tab === 'Discover' ? <View>
        <ImageBackground source={require('./assets/discovery-hero.png')} style={styles.heroImage} imageStyle={styles.heroImageCorners}><Text style={styles.heroKicker}>DISCOVER NEARBY</Text><Text style={styles.heroTitle}>{'More life,\nright outside.'}</Text></ImageBackground>
        <View style={styles.agentPanel}><Text style={styles.agentKicker}>✦ YOUR PERSONAL SCOUT</Text><Text style={styles.agentTitle}>What are you in the mood for?</Text><Text style={styles.agentLead}>A free hour, a new skill, a little adventure. Tell PB&B what would feel good.</Text>
          <TextInput value={agentPrompt} onChangeText={setAgentPrompt} onSubmitEditing={() => runScout(agentPrompt)} placeholder="Try “free dance class this weekend”" placeholderTextColor="#85989B" style={styles.agentInput} returnKeyType="search" />
          <Action label="Find my next thing" onPress={() => runScout(agentPrompt)} />
          <View style={styles.promptRow}>{['Free this weekend', 'Something creative', 'Surprise me'].map(prompt => <Pressable key={prompt} onPress={() => { setAgentPrompt(prompt); runScout(prompt); }} style={styles.promptChip}><Text style={styles.promptText}>{prompt}</Text></Pressable>)}</View>
        </View>
        {activeRequest !== null && <View style={styles.agentResults}><View style={styles.rowBetween}><Text style={styles.subheading}>A few ideas for you</Text><Pressable onPress={() => { setActiveRequest(null); setAgentPrompt(''); }}><Text style={styles.clearText}>Clear</Text></Pressable></View>
          <Text style={styles.resultIntro}>{activeRequest.trim() ? `For “${activeRequest.trim()}”` : 'Based on your interests and practical limits'}</Text>
          {scoutMessage ? <Text style={styles.notice}>{scoutMessage}</Text> : null}
          {scoutLoading ? <Text style={styles.notice}>Your scout is looking…</Text> : agentSuggestions.length ? agentSuggestions.map(suggestion => <View key={suggestion.item.id}><Text style={styles.whyText}>WHY IT FITS · {suggestion.reasons.join(' · ')}</Text>{itemCard(suggestion.item)}</View>) : <View style={styles.empty}><Text style={styles.emptyTitle}>{showingTorontoSamples && !remoteScoutConfigured ? 'No close match in these sample ideas.' : `No verified match for ${preferences.place} yet.`}</Text><Text style={styles.summary}>{showingTorontoSamples && !remoteScoutConfigured ? 'Try another interest, more time, a larger budget, or a wider radius.' : 'Try another interest or adjust your budget or radius. Real listings need verified organizer sources.'}</Text></View>}
          <View style={styles.chipRow}><Pill label="Something different" active={agentMode === 'different'} onPress={() => runScout(activeRequest, 'different')} /><Pill label="Cheaper" active={agentMode === 'cheaper'} onPress={() => runScout(activeRequest, 'cheaper')} /><Pill label="Closer" active={agentMode === 'closer'} onPress={() => runScout(activeRequest, 'closer')} /></View>
        </View>}
        <Text style={styles.sectionKicker}>BROWSE AT YOUR PACE</Text><Text style={styles.h1}>Discover the unexpected.</Text><Text style={styles.lead}>{remoteItems.length ? `Ideas for ${preferences.place}, with official sources on live listings.` : showingTorontoSamples ? 'Sample ideas around Toronto, shaped by what you love and what works for you.' : `Local listings for ${preferences.place} will appear here when verified sources are connected.`}</Text>
        {alerts.length > 0 && <Pressable onPress={() => setTab('You')} style={styles.alertBanner}><Text style={styles.alertBannerTitle}>✦ {alerts.length} timely {alerts.length === 1 ? 'find' : 'finds'} for you</Text><Text style={styles.alertBannerBody}>New opportunities that fit your interests. See alerts →</Text></Pressable>}
        <TextInput value={query} onChangeText={setQuery} placeholder="Try dance, pottery, or something unusual" placeholderTextColor="#8A9AA1" style={styles.search} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}><Pill label="All" active={category === 'All'} onPress={() => setCategory('All')} />{categories.map(value => <Pill key={value} label={value} active={category === value} onPress={() => setCategory(value)} />)}</ScrollView>
        <View style={styles.rowBetween}><Text style={styles.subheading}>{showDiverse ? 'A different direction' : 'Picked for you'}</Text><Text style={styles.resultCount}>{diverse.length} ideas</Text></View>
        {catalogLoading ? <Text style={styles.notice}>Loading ideas…</Text> : diverse.length ? diverse.map(itemCard) : <View style={styles.empty}><Text style={styles.emptyTitle}>Nothing fits these filters yet.</Text><Text style={styles.summary}>Try a larger budget or travel radius, or choose another interest.</Text></View>}
        <Action label={showDiverse ? 'Back to your picks' : 'Show me something different'} onPress={() => setShowDiverse(value => !value)} secondary />
        <Text style={styles.footerNote}>Sample listings are illustrative. For live listings, check the organizer source before leaving.</Text>
      </View> : tab === 'Now' ? <View>
        <Text style={styles.sectionKicker}>SPONTANEOUS</Text><Text style={styles.h1}>Have a little time?</Text><Text style={styles.lead}>Find something that fits your day and your budget.</Text>
        <Text style={styles.label}>Time available</Text><View style={styles.chipRow}>{[1, 2, 3, 5].map(value => <Pill key={value} label={`${value} hr`} active={timeHours === value} onPress={() => setTimeHours(value)} />)}</View>
        {ranked.filter(item => item.durationHours <= timeHours && daysUntil(item.startsAt) <= 2).map(itemCard)}
        {!ranked.some(item => item.durationHours <= timeHours && daysUntil(item.startsAt) <= 2) && <Text style={styles.notice}>No sample idea fits the next two days. Try more time or adjust your preferences.</Text>}
      </View> : tab === 'Along the Way' ? <View>
        <Text style={styles.sectionKicker}>A LITTLE DETOUR</Text><Text style={styles.h1}>Along the way.</Text><Text style={styles.lead}>See sample stops that could add a memorable pause to a journey.</Text>
        <TextInput value={destination} onChangeText={setDestination} placeholder="Where are you heading?" placeholderTextColor="#8A9AA1" style={styles.search} />
        <Text style={styles.notice}>Route matching is coming next. Toronto sample stops appear only when exploring Toronto; entering a destination does not calculate a route.</Text>
        {ranked.filter(item => item.alongWay).map(itemCard)}
      </View> : tab === 'Saved' ? <View>
        <Text style={styles.sectionKicker}>YOUR SHORTLIST</Text><Text style={styles.h1}>Saved for later.</Text><Text style={styles.lead}>Keep possibilities close. Saved interests can qualify for timely in-app alerts.</Text>
        {allItems.filter(item => savedIds.includes(item.id)).map(itemCard)}
        {!allItems.some(item => savedIds.includes(item.id)) && <View style={styles.empty}><Text style={styles.emptyTitle}>No saved ideas in this place.</Text><Text style={styles.summary}>Save an experience from Discover to find it here.</Text><Action label="Explore ideas" onPress={() => setTab('Discover')} small /></View>}
      </View> : <View>
        <Text style={styles.sectionKicker}>YOUR DISCOVERY DNA</Text><Text style={styles.h1}>Made for your curiosity.</Text><Text style={styles.lead}>Set the boundaries. Your choices stay on this device in this prototype.</Text>
        <Text style={styles.subheading}>Timely finds</Text>
        {alerts.length ? alerts.map(alert => <Pressable key={alert.item.id} onPress={() => setSelected(alert.item)} style={styles.alertCard}><Text style={styles.alertTag}>✦ {alert.reason}</Text><Text style={styles.alertTitle}>{alert.item.title}</Text><Text style={styles.cardMeta}>Starts {formatDate(alert.item.startsAt)} · {money(alert.item.totalCost, alert.item.currency)} · {alert.item.distanceKm} km</Text><Text style={styles.alertLink}>See details →</Text></Pressable>) : <View style={styles.empty}><Text style={styles.emptyTitle}>No timely finds right now.</Text><Text style={styles.summary}>Enable alerts and choose interests to see matching sample opportunities.</Text></View>}
        <Text style={styles.notice}>Check each listing source and confirm details with the organizer before leaving. Events can fill, sell out, close due to weather, or change unexpectedly. AI can make mistakes. These alerts appear in the app only; push notifications are not connected.</Text>
        <Text style={styles.subheading}>Exploring</Text><TextInput value={preferences.place} onChangeText={place => setPreferences(current => ({ ...current, place }))} placeholder="City and country" placeholderTextColor="#8A9AA1" style={styles.search} />
        <Text style={styles.label}>Budget currency · three-letter code</Text><TextInput value={preferences.currency} onChangeText={currency => setPreferences(current => ({ ...current, currency: currency.replace(/[^a-z]/gi, '').slice(0, 3).toUpperCase() }))} placeholder="e.g. EUR, JPY, BRL" autoCapitalize="characters" maxLength={3} style={styles.search} />
        <Text style={styles.subheading}>Interests</Text><View style={styles.chipRow}>{categories.map(value => <Pill key={value} label={value} active={preferences.interests.includes(value)} onPress={() => toggleInterest(value)} />)}</View>
        <View style={styles.settingsRow}><View><Text style={styles.label}>Maximum budget</Text><Text style={styles.helper}>Per experience, {preferences.currency}</Text></View><TextInput style={styles.numberInput} keyboardType="number-pad" value={String(preferences.maxBudget)} onChangeText={value => setNumber('maxBudget', value)} /></View>
        <View style={styles.settingsRow}><View><Text style={styles.label}>Travel radius</Text><Text style={styles.helper}>Kilometres from your chosen place</Text></View><TextInput style={styles.numberInput} keyboardType="number-pad" value={String(preferences.maxDistanceKm)} onChangeText={value => setNumber('maxDistanceKm', value)} /></View>
        <Setting label="Show timely in-app alerts" value={preferences.alertsEnabled} onPress={() => setPreferences(current => ({ ...current, alertsEnabled: !current.alertsEnabled }))} />
        <Setting label="Highlight free opportunities" value={preferences.freeAlerts} onPress={() => setPreferences(current => ({ ...current, freeAlerts: !current.freeAlerts }))} />
        <Setting label="Watch saved interests" value={preferences.savedAlerts} onPress={() => setPreferences(current => ({ ...current, savedAlerts: !current.savedAlerts }))} />
        <Action label="Clear passes and loves" onPress={() => setFeedback({})} secondary />
      </View>}
    </ScrollView>
    {!selected && <View style={styles.tabBar}>{tabs.map(value => <Pressable key={value} onPress={() => setTab(value)} style={styles.tab}><Text style={[styles.tabIcon, tab === value && styles.tabActive]}>{value === 'Discover' ? '✦' : value === 'Now' ? '◷' : value === 'Along the Way' ? '↗' : value === 'Saved' ? '♡' : '◉'}</Text><Text style={[styles.tabText, tab === value && styles.tabActive]}>{value === 'Along the Way' ? 'Along' : value}</Text></Pressable>)}</View>}
  </SafeAreaView>;
}

function Setting({ label, value, onPress }: { label: string; value: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.setting}><Text style={styles.label}>{label}</Text><View style={[styles.toggle, value && styles.toggleOn]}><View style={[styles.toggleKnob, value && styles.toggleKnobOn]} /></View></Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F6F1' }, header: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: '#E6E8E1' },
  heroImage: { height: 185, borderRadius: 20, padding: 21, justifyContent: 'flex-end', marginBottom: 16, overflow: 'hidden' }, heroImageCorners: { borderRadius: 20 }, heroKicker: { color: '#BDE4D9', fontSize: 10, fontWeight: '900', letterSpacing: 1.6, marginBottom: 7 }, heroTitle: { color: '#FFFFFF', fontSize: 27, fontWeight: '900', lineHeight: 31, letterSpacing: -0.6, maxWidth: 190 },
  agentPanel: { backgroundColor: '#163B48', borderRadius: 23, padding: 22, marginBottom: 26, overflow: 'hidden' }, agentKicker: { color: '#A7DBCE', fontWeight: '900', letterSpacing: 1.4, fontSize: 11, marginBottom: 14 }, agentTitle: { color: '#FFFFFF', fontSize: 29, lineHeight: 34, fontWeight: '900', letterSpacing: -0.7, marginBottom: 8 }, agentLead: { color: '#D3E1DF', fontSize: 14, lineHeight: 20, marginBottom: 18 }, agentInput: { backgroundColor: '#FFFFFF', borderRadius: 12, color: ink, paddingHorizontal: 15, paddingVertical: 13, fontSize: 14, marginBottom: 10 }, promptRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, promptChip: { borderRadius: 18, backgroundColor: '#315967', paddingHorizontal: 11, paddingVertical: 8 }, promptText: { color: '#E2F0EC', fontWeight: '700', fontSize: 11 }, agentResults: { marginBottom: 28 }, resultIntro: { color: muted, fontSize: 13, marginBottom: 15 }, whyText: { color: sea, fontWeight: '800', fontSize: 10, lineHeight: 15, letterSpacing: 0.4, marginBottom: 8 }, clearText: { color: sea, fontWeight: '800', fontSize: 12 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }, welcome: { padding: 24, paddingTop: 52, paddingBottom: 52, maxWidth: 650, width: '100%', alignSelf: 'center' }, welcomeTitle: { color: ink, fontSize: 38, lineHeight: 43, fontWeight: '900', letterSpacing: -1.5, marginBottom: 12 }, undoBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#E6F2EB', borderRadius: 12, padding: 13, marginBottom: 15 }, undoText: { color: ink, fontSize: 12, flex: 1, marginRight: 10 }, undoLink: { color: sea, fontWeight: '800', fontSize: 13 },
  brand: { color: ink, fontWeight: '900', fontSize: 25, letterSpacing: -1.5 }, brandStar: { color: '#E77453' }, brandSub: { color: muted, fontSize: 11, letterSpacing: 0.3 }, avatar: { backgroundColor: '#D9E8E4', height: 38, width: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: sea, fontWeight: '800', fontSize: 10 },
  content: { flex: 1 }, contentInner: { padding: 22, paddingBottom: 40, maxWidth: 800, width: '100%', alignSelf: 'center' }, sectionKicker: { color: sea, fontWeight: '800', letterSpacing: 2, fontSize: 11, marginBottom: 10 }, h1: { color: ink, fontSize: 34, lineHeight: 39, fontWeight: '800', letterSpacing: -1.2, marginBottom: 10 }, lead: { color: muted, fontSize: 15, lineHeight: 22, marginBottom: 24 },
  alertBanner: { backgroundColor: '#E6F2EB', borderRadius: 18, padding: 18, marginBottom: 20 }, alertBannerTitle: { color: '#1D665B', fontWeight: '800', fontSize: 17 }, alertBannerBody: { color: '#376B63', marginTop: 5, fontSize: 13 }, search: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E8E4', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, color: ink, fontSize: 14, marginBottom: 18 }, chipScroll: { marginBottom: 22 }, chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 }, pill: { paddingHorizontal: 15, paddingVertical: 9, borderRadius: 22, borderWidth: 1, borderColor: '#DCE2DF', backgroundColor: '#FFFFFF', marginRight: 7, marginBottom: 3 }, pillActive: { backgroundColor: sea, borderColor: sea }, pillText: { color: '#46616A', fontWeight: '700', fontSize: 12 }, pillTextActive: { color: '#FFFFFF' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, subheading: { color: ink, fontWeight: '800', fontSize: 21, marginBottom: 14 }, resultCount: { color: muted, fontSize: 12 }, card: { borderRadius: 18, backgroundColor: '#FFFFFF', overflow: 'hidden', borderWidth: 1, borderColor: '#EAECE8', marginBottom: 18 }, cardArt: { height: 110, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }, artGlyph: { color: '#FFFFFF', opacity: 0.9, fontSize: 72, lineHeight: 80, fontWeight: '200' }, artLabel: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', letterSpacing: 2 }, cardBody: { padding: 17 }, eyebrow: { color: sea, textTransform: 'uppercase', fontWeight: '800', fontSize: 10, letterSpacing: 0.9 }, cost: { color: ink, fontWeight: '800', fontSize: 12 }, cardTitle: { color: ink, fontWeight: '800', fontSize: 21, lineHeight: 26, marginTop: 8, marginBottom: 5 }, cardMeta: { color: muted, fontSize: 12, marginBottom: 10 }, summary: { color: '#566B72', fontSize: 14, lineHeight: 20 }, cardActions: { marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7 }, action: { backgroundColor: sea, borderRadius: 11, paddingHorizontal: 17, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }, actionSecondary: { backgroundColor: '#EDF4F1', borderWidth: 1, borderColor: '#D4E5E0' }, actionSmall: { paddingHorizontal: 12, paddingVertical: 10, marginBottom: 0 }, actionText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 }, actionTextSecondary: { color: sea }, textAction: { paddingHorizontal: 6, paddingVertical: 10 }, textActionLabel: { color: sea, fontWeight: '700', fontSize: 12 },
  empty: { padding: 22, backgroundColor: '#FFFFFF', borderRadius: 18, marginBottom: 20 }, emptyTitle: { color: ink, fontWeight: '800', fontSize: 17, marginBottom: 6 }, footerNote: { color: '#839097', fontSize: 11, textAlign: 'center', marginTop: 14 }, label: { color: ink, fontSize: 14, fontWeight: '700', marginBottom: 6 }, helper: { color: muted, fontSize: 11 }, notice: { backgroundColor: '#FFF5E8', color: '#786147', borderRadius: 12, padding: 14, lineHeight: 19, fontSize: 12, marginBottom: 20 },
  back: { color: sea, fontWeight: '700', marginBottom: 18 }, detailArt: { borderRadius: 18, height: 190, alignItems: 'center', justifyContent: 'center', marginBottom: 22 }, detailGlyph: { color: '#FFFFFF', fontSize: 100, lineHeight: 110 }, detailCategory: { color: '#FFFFFF', fontWeight: '900', letterSpacing: 2 }, infoPanel: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, marginBottom: 20 }, infoText: { color: ink, fontSize: 14, marginBottom: 10 },
  alertCard: { backgroundColor: '#E6F2EB', padding: 18, borderRadius: 16, marginBottom: 12 }, alertTag: { color: sea, fontWeight: '800', textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.8 }, alertTitle: { color: ink, fontSize: 17, fontWeight: '800', marginVertical: 8 }, alertLink: { color: sea, fontWeight: '800', fontSize: 12 }, settingsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderColor: '#E3E7E3' }, numberInput: { width: 76, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE2DF', borderRadius: 10, textAlign: 'center', padding: 9, color: ink, fontWeight: '800' }, setting: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderColor: '#E3E7E3' }, toggle: { width: 44, height: 26, borderRadius: 13, backgroundColor: '#C9D4D2', padding: 3 }, toggleOn: { backgroundColor: sea }, toggleKnob: { width: 20, height: 20, backgroundColor: '#FFFFFF', borderRadius: 10 }, toggleKnobOn: { alignSelf: 'flex-end' },
  tabBar: { flexDirection: 'row', borderTopWidth: 1, borderColor: '#E6E8E1', backgroundColor: '#FFFFFF', paddingBottom: 5, paddingTop: 6 }, tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 }, tabIcon: { color: '#8C9A9D', fontSize: 22 }, tabText: { color: '#8C9A9D', fontSize: 10, fontWeight: '700' }, tabActive: { color: sea },
});
