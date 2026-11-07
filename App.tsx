import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import React, { useEffect, useMemo, useState } from 'react';
import { ImageBackground, Linking, ScrollView, StyleSheet, Text, TextInput, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { categories, daysUntil, defaultPreferences, interestTopics, money, opportunityAlerts, rankExperiences, type Category, type Experience, type Feedback, type Preferences, type InterestTopic, type TravelMode, matchedTopics, topicGroups, travelModeLabels, travelModes } from './src/logic';
import { currencyForCountry, currencyName, currencyOptions } from './src/currencies';
import { formatDistance, fromKilometres, toKilometres } from './src/units';
import { catalog } from './src/catalog';
import { sampleExperiences } from './src/sampleData';
import { chooseSerendipity } from './src/serendipity';
import { planReminders } from './src/reminders';
import { listenForSourceTaps, phoneAlertsAllowed, requestPhoneAlerts, sendSampleAlert, syncPhoneReminders } from './src/phoneAlerts';
import { dailyScoutConfigured, getDailyPushToken, saveDailyScoutSubscription } from './src/dailyScout';
import { interpretIntent, recommendForIntent, type DiscoveryMode } from './src/agent';
import { askRemoteScout, pickToExperience, remoteScoutConfigured, type ScoutCitation } from './src/remoteScout';

type Tab = 'Discover' | 'Now' | 'Along the Way' | 'Saved' | 'Settings';
type StoredState = { preferences: Preferences; feedback: Feedback; savedIds: string[]; savedItems: Experience[] };
const STORAGE_KEY = 'pbb-local-state-v1';
const tabs: Tab[] = ['Discover', 'Now', 'Along the Way', 'Saved', 'Settings'];
const ink = '#103D46';
const muted = '#45656B';
const sea = '#103D46';
const sampleImages: Record<string, number> = {
  'sketch-walk': require('./assets/sketch-walk-autumn.png'),
  ballroom: require('./assets/discovery-hero-v2.png'),
  'line-dance': require('./assets/line-dance.png'),
  pottery: require('./assets/pottery-workshop.png'),
  birdwalk: require('./assets/birding-walk.png'),
  printmaking: require('./assets/pottery-workshop.png'),
  'forest-bath': require('./assets/birding-walk.png'),
};

function Pill({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.pill, active && styles.pillActive]}><Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text></Pressable>;
}

function Action({ label, onPress, secondary, small }: { label: string; onPress: () => void; secondary?: boolean; small?: boolean }) {
  return <Pressable onPress={onPress} style={[styles.action, secondary && styles.actionSecondary, small && styles.actionSmall]}><Text style={[styles.actionText, secondary && styles.actionTextSecondary]}>{label}</Text></Pressable>;
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function CitedScoutText({ message, citations }: { message: string; citations: ScoutCitation[] }) {
  let cursor = 0;
  const parts: React.ReactNode[] = [];
  for (const [index, citation] of citations.entries()) {
    if (citation.startIndex < cursor || citation.endIndex > message.length) continue;
    parts.push(<Text key={`text-${index}`}>{message.slice(cursor, citation.startIndex)}</Text>);
    parts.push(<Text key={`link-${index}`} style={styles.alertLink} onPress={() => { void Linking.openURL(citation.url); }}>{message.slice(citation.startIndex, citation.endIndex)}</Text>);
    cursor = citation.endIndex;
  }
  parts.push(<Text key="end">{message.slice(cursor)}</Text>);
  return <View style={styles.notice}><Text style={styles.summary}>{parts}</Text><Text style={styles.helper}>Open each cited source and confirm details before making plans.</Text></View>;
}

function Card({ item, saved, loved, distanceUnit, onOpen, onSave, onLove, onPass }: { item: Experience; saved: boolean; loved: boolean; distanceUnit: Preferences['distanceUnit']; onOpen: () => void; onSave: () => void; onLove: () => void; onPass: () => void }) {
  const artInk = item.accent === '#103D46' ? '#F5F8F7' : '#103D46';
  const sampleImage = item.mode === 'live' ? undefined : sampleImages[item.id];
  const checked = item.verifiedAt ? Date.parse(item.verifiedAt) : NaN;
  const checkedRecently = Number.isFinite(checked) && checked <= Date.now() && Date.now() - checked <= 48 * 60 * 60 * 1000;
  return <View style={styles.card}>
    {sampleImage ? <ImageBackground source={sampleImage} style={styles.cardPhoto}><Text style={styles.photoLabel}>ILLUSTRATIVE PHOTO</Text></ImageBackground> : <View style={[styles.cardArt, { backgroundColor: item.accent }]}><Text style={[styles.artGlyph, { color: artInk }]}>{item.category === 'Dance' ? '✦' : item.category === 'Outdoors' ? '◒' : item.category === 'Arts' ? '✳' : item.category === 'Food' ? '◌' : item.category === 'Learning' ? '✧' : '☼'}</Text><Text style={[styles.artLabel, { color: artInk }]}>{item.category.toUpperCase()}</Text></View>}
    <View style={styles.cardBody}>
      <View style={styles.rowBetween}><Text style={styles.eyebrow}>{item.mode === 'live' ? checkedRecently ? 'Source checked recently' : 'Recheck source' : 'Sample'} · {item.format} · {formatDate(item.startsAt)}</Text><Text style={styles.cost}>{money(item.totalCost, item.currency)}</Text></View>
      <Text style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.cardMeta}>{item.location}{item.place ? ` · ${item.place}` : ''} · {formatDistance(item.distanceKm, distanceUnit)} · {item.durationHours} hr</Text>
      {item.signupBy && <Text style={styles.deadlineText}>{item.mode === 'live' ? 'Listed sign-up by' : 'Sample sign-up by'} {formatDate(item.signupBy)} · check source</Text>}
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
  const [savedItems, setSavedItems] = useState<Experience[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [lastPassed, setLastPassed] = useState<{ item: Experience; wasSaved: boolean } | null>(null);
  const [experiences, setExperiences] = useState<Experience[]>(remoteScoutConfigured ? [] : sampleExperiences);
  const [catalogLoading, setCatalogLoading] = useState(remoteScoutConfigured);
  const [selected, setSelected] = useState<Experience | null>(null);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [showMoreIdeas, setShowMoreIdeas] = useState(false);
  const [topicsOpen, setTopicsOpen] = useState(false);
  const [topicGroupOpen, setTopicGroupOpen] = useState<string | null>(null);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [currencyQuery, setCurrencyQuery] = useState('');
  const [suggestedCurrency, setSuggestedCurrency] = useState<string | undefined>();
  const [serendipityOpen, setSerendipityOpen] = useState(false);
  const [travelMode, setTravelMode] = useState<TravelMode>('walk');
  const [serendipityPick, setSerendipityPick] = useState<Experience | null>(null);
  const [serendipityTried, setSerendipityTried] = useState(false);
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
  const [scoutCitations, setScoutCitations] = useState<ScoutCitation[]>([]);
  const [autoScoutStatus, setAutoScoutStatus] = useState('');
  const [phoneAlertMessage, setPhoneAlertMessage] = useState('');
  const [dailyScoutMessage, setDailyScoutMessage] = useState('');
  const [locationMessage, setLocationMessage] = useState('');
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) {
        const saved = JSON.parse(raw) as Partial<StoredState>;
        if (saved.preferences) setPreferences({ ...defaultPreferences, ...saved.preferences, interests: Array.isArray(saved.preferences.interests) ? saved.preferences.interests : defaultPreferences.interests, topics: Array.isArray(saved.preferences.topics) ? saved.preferences.topics.filter((topic): topic is InterestTopic => interestTopics.includes(topic as InterestTopic)) : [], travelModes: Array.isArray(saved.preferences.travelModes) ? saved.preferences.travelModes : defaultPreferences.travelModes, distanceUnit: saved.preferences.distanceUnit === 'mi' ? 'mi' : 'km', place: saved.preferences.place || 'Toronto, Canada' });
        if (saved.feedback) setFeedback(saved.feedback);
        if (saved.savedIds) setSavedIds(saved.savedIds);
        if (Array.isArray(saved.savedItems)) setSavedItems(saved.savedItems.filter(item => item?.mode === 'live' && typeof item.id === 'string' && item.sourceUrl?.startsWith('https://')).slice(0, 100));
      }
    }).catch(() => {}).finally(() => setHydrated(true));
  }, []);
  useEffect(() => {
    if (hydrated) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ preferences, feedback, savedIds, savedItems })).catch(() => {});
  }, [preferences, feedback, savedIds, savedItems, hydrated]);
  useEffect(() => { const subscription = listenForSourceTaps(); return () => subscription.remove(); }, []);
  useEffect(() => {
    catalog.load().then(result => setExperiences(result.items)).catch(() => setExperiences([])).finally(() => setCatalogLoading(false));
  }, []);
  useEffect(() => { setRemoteSuggestions([]); setRemoteItems([]); setActiveRequest(null); setSerendipityPick(null); setSerendipityTried(false); }, [preferences.place, preferences.currency]);
  useEffect(() => { if (!(preferences.travelModes ?? []).includes(travelMode)) setTravelMode((preferences.travelModes ?? [])[0] ?? 'walk'); }, [preferences.travelModes, travelMode]);

  const showingTorontoSamples = (/^(toronto)(?:\b|,)/i.test(preferences.place.trim()) || /^ontario(?:,?\s*canada)?$/i.test(preferences.place.trim())) && preferences.currency === 'CAD';
  const localExamples = useMemo(() => showingTorontoSamples ? experiences : [], [experiences, showingTorontoSamples]);
  const allItems = useMemo(() => [...remoteItems, ...localExamples.filter(item => !remoteItems.some(remote => remote.id === item.id))], [remoteItems, localExamples]);
  const savedVisible = useMemo(() => {
    const byId = new Map([...savedItems, ...allItems].map(item => [item.id, item]));
    return [...byId.values()].filter(item => savedIds.includes(item.id));
  }, [savedItems, allItems, savedIds]);
  const ranked = useMemo(() => rankExperiences(allItems, preferences, feedback, savedIds), [allItems, preferences, feedback, savedIds]);
  const alerts = useMemo(() => opportunityAlerts(allItems, preferences, feedback, savedIds), [allItems, preferences, feedback, savedIds]);
  useEffect(() => {
    if (!hydrated || !remoteScoutConfigured || process.env.EXPO_PUBLIC_PBB_AUTO_SCOUT !== '1' || !preferences.place.includes(',') || !/^[A-Z]{3}$/.test(preferences.currency)) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setAutoScoutStatus('Your scout is checking for ideas…');
      try {
        const result = await askRemoteScout('Find experiences that match my saved interests and practical limits', preferences, 'balanced');
        if (cancelled) return;
        setRemoteItems(result.picks.map(pickToExperience));
        setAutoScoutStatus(result.mode === 'live' ? 'Your scout checked source-linked ideas.' : 'Your scout found sample ideas.');
      } catch {
        if (!cancelled) setAutoScoutStatus('Live scout is unavailable right now.');
      }
    }, 900);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [hydrated, preferences.place, preferences.currency, preferences.maxBudget, preferences.maxDistanceKm, preferences.interests.join(','), preferences.topics.join(','), preferences.travelModes.join(',')]);
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    phoneAlertsAllowed().then(allowed => {
      if (!cancelled) return syncPhoneReminders(allowed ? planReminders(allItems, preferences, feedback, savedIds) : []);
    }).catch(() => { if (!cancelled) setPhoneAlertMessage('Phone reminders could not be updated.'); });
    return () => { cancelled = true; };
  }, [hydrated, allItems, preferences, feedback, savedIds]);
  useEffect(() => {
    if (!hydrated || !dailyScoutConfigured || !preferences.dailyScoutEnabled) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        if (!(await phoneAlertsAllowed())) return;
        const token = await getDailyPushToken();
        if (!cancelled) await saveDailyScoutSubscription(true, preferences, token);
      } catch { if (!cancelled) setDailyScoutMessage('Daily scout settings could not be updated.'); }
    }, 1200);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [hydrated, preferences.dailyScoutEnabled, preferences.place, preferences.currency, preferences.maxBudget, preferences.maxDistanceKm, preferences.interests.join(','), preferences.topics.join(','), preferences.travelModes.join(',')]);
  const agentSuggestions = useMemo(() => remoteScoutConfigured ? remoteSuggestions.map(suggestion => ({ item: suggestion.item, reasons: [suggestion.reason] })) : activeRequest === null ? [] : recommendForIntent(localExamples, preferences, feedback, savedIds, interpretIntent(activeRequest), agentMode).slice(0, 3), [localExamples, preferences, feedback, savedIds, activeRequest, agentMode, remoteSuggestions]);
  const visible = ranked.filter(item => (category === 'All' || item.category === category) && (!query || `${item.title} ${item.category} ${item.tags.join(' ')} ${item.location}`.toLowerCase().includes(query.toLowerCase())));
  const diverse = showDiverse ? [...visible].sort((a, b) => Number(preferences.interests.includes(a.category)) - Number(preferences.interests.includes(b.category))) : visible;
  const sponsoredPreviews = showingTorontoSamples && category === 'All' && !query.trim() ? diverse.filter(item => item.id === 'pottery' || item.id === 'ballroom') : [];
  const organicItems = diverse.filter(item => !sponsoredPreviews.some(sponsored => sponsored.id === item.id));
  const homeOrganicItems = showMoreIdeas || searchOpen || category !== 'All' || !!query.trim() ? organicItems : organicItems.slice(0, 3);
  const drawSerendipity = () => {
    const next = chooseSerendipity(allItems, preferences, feedback, travelMode, serendipityPick?.id);
    setSerendipityPick(next);
    setSerendipityTried(true);
  };
  const fitReason = (item: Experience) => {
    const topic = matchedTopics(item, preferences.topics ?? [])[0];
    return topic ? `FITS YOUR ${topic.toUpperCase()} INTEREST · ${money(item.totalCost, item.currency)} · ${formatDistance(item.distanceKm, preferences.distanceUnit).toUpperCase()}`
      : preferences.interests.includes(item.category) ? `FITS YOUR ${item.category.toUpperCase()} INTEREST · ${money(item.totalCost, item.currency)} · ${formatDistance(item.distanceKm, preferences.distanceUnit).toUpperCase()}`
      : `A FRESH IDEA WITHIN YOUR ${preferences.maxBudget} ${preferences.currency} BUDGET`;
  };
  const togglePhoneAlerts = async () => {
    if (preferences.phoneAlertsEnabled) { setPreferences(current => ({ ...current, phoneAlertsEnabled: false })); setPhoneAlertMessage('Phone reminders are off.'); return; }
    try {
      const allowed = await requestPhoneAlerts();
      if (allowed) { setPreferences(current => ({ ...current, phoneAlertsEnabled: true })); setPhoneAlertMessage('Phone reminders are on for verified matches.'); }
      else setPhoneAlertMessage('Allow notifications in your phone settings to turn on reminders.');
    } catch { setPhoneAlertMessage('Phone notifications could not be enabled.'); }
  };
  const toggleDailyScout = async () => {
    if (!dailyScoutConfigured) { setDailyScoutMessage('Daily web scout alerts are not connected yet. The online service and phone push setup are still being prepared.'); return; }
    try {
      if (preferences.dailyScoutEnabled) {
        await saveDailyScoutSubscription(false, preferences);
        setPreferences(current => ({ ...current, dailyScoutEnabled: false }));
        setDailyScoutMessage('Daily scout alerts are off.');
        return;
      }
      if (!(await requestPhoneAlerts())) { setDailyScoutMessage('Allow notifications in your phone settings to turn on daily alerts.'); return; }
      const token = await getDailyPushToken();
      await saveDailyScoutSubscription(true, preferences, token);
      setPreferences(current => ({ ...current, dailyScoutEnabled: true }));
      setDailyScoutMessage('Daily web scout alerts are on. Possible weekend ideas and sign-up deadlines will link to their source.');
    } catch { setDailyScoutMessage('Daily alerts could not be connected. Check the live service and push credentials.'); }
  };
  const useCurrentLocation = async () => {
    setLocationBusy(true);
    setLocationMessage('Finding your nearby city…');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setLocationDenied(true);
        setLocationMessage('Location is off for PB&B. Allow it in your phone settings, or enter a city below.');
        return;
      }
      setLocationDenied(false);
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [address] = await Location.reverseGeocodeAsync(position.coords);
      const city = address?.city || address?.subregion || address?.region;
      const country = address?.country;
      if (!city || !country) throw new Error('No nearby city found');
      const place = `${city}, ${country}`;
      const localCurrency = currencyForCountry(address.isoCountryCode);
      setSuggestedCurrency(localCurrency);
      setPreferences(current => ({ ...current, place, currency: localCurrency ?? current.currency }));
      setLocationMessage(localCurrency ? `Exploring near ${place}. ${localCurrency} was selected from your location; you can change it below.` : `Exploring near ${place}. Choose a currency below.`);
    } catch {
      setLocationMessage('We could not find a nearby city. You can still enter one below.');
    } finally {
      setLocationBusy(false);
    }
  };
  const toggleSaved = (item: Experience) => {
    const alreadySaved = savedIds.includes(item.id);
    setSavedIds(current => current.includes(item.id) ? current.filter(value => value !== item.id) : [...current, item.id]);
    if (item.mode === 'live') setSavedItems(current => alreadySaved ? current.filter(value => value.id !== item.id) : [item, ...current.filter(value => value.id !== item.id)].slice(0, 100));
  };
  const toggleInterest = (value: Category) => setPreferences(current => ({ ...current, interests: current.interests.includes(value) ? current.interests.filter(item => item !== value) : [...current.interests, value] }));
  const toggleTopic = (value: InterestTopic) => setPreferences(current => ({ ...current, topics: current.topics.includes(value) ? current.topics.filter(item => item !== value) : [...current.topics, value] }));
  const toggleTravel = (value: TravelMode) => setPreferences(current => ({ ...current, travelModes: current.travelModes.includes(value) ? current.travelModes.filter(item => item !== value) : [...current.travelModes, value] }));
  const setNumber = (key: 'maxBudget', value: string) => {
    const number = Number(value.replace(/[^0-9]/g, ''));
    setPreferences(current => ({ ...current, [key]: Number.isFinite(number) ? number : 0 }));
  };
  const setRadius = (value: string) => {
    const number = Number(value.replace(/[^0-9]/g, ''));
    setPreferences(current => ({ ...current, maxDistanceKm: Math.max(0, Math.min(500, toKilometres(Number.isFinite(number) ? number : 0, current.distanceUnit))) }));
  };
  const runScout = async (prompt: string, refinement: DiscoveryMode = 'balanced') => {
    setActiveRequest(prompt);
    setAgentMode(refinement);
    setScoutMessage('');
    setScoutCitations([]);
    if (!remoteScoutConfigured) { setScoutMessage('Preview mode: showing matching sample ideas below. Live AI search is not connected yet.'); return; }
    if (!preferences.place.trim() || !/^[A-Z]{3}$/.test(preferences.currency)) { setScoutMessage('Enter a city, country, and three-letter currency in Settings first.'); return; }
    setScoutLoading(true);
    try {
      const result = await askRemoteScout(prompt, preferences, refinement);
      const suggestions = result.picks.map(pick => ({ item: pickToExperience(pick), reason: pick.reason }));
      setRemoteSuggestions(suggestions);
      setRemoteItems(current => [...suggestions.map(suggestion => suggestion.item), ...current.filter(item => !suggestions.some(suggestion => suggestion.item.id === item.id))]);
      setScoutMessage(result.message);
      setScoutCitations(result.citations ?? []);
    } catch (error) {
      setRemoteSuggestions([]);
      setScoutMessage(error instanceof Error ? `The scout is unavailable: ${error.message}` : 'The scout is unavailable. Please try again.');
    } finally { setScoutLoading(false); }
  };
  const itemCard = (item: Experience) => <Card key={item.id} item={item} distanceUnit={preferences.distanceUnit} saved={savedIds.includes(item.id)} loved={feedback[item.id] === 'love'} onOpen={() => setSelected(item)} onSave={() => toggleSaved(item)} onLove={() => setFeedback(current => { const next = { ...current }; if (next[item.id] === 'love') delete next[item.id]; else next[item.id] = 'love'; return next; })} onPass={() => { setFeedback(current => ({ ...current, [item.id]: 'pass' })); setSavedIds(current => current.filter(id => id !== item.id)); setSavedItems(current => current.filter(value => value.id !== item.id)); setLastPassed({ item, wasSaved: savedIds.includes(item.id) }); }} />;
  const undoPass = () => {
    if (!lastPassed) return;
    setFeedback(current => { const next = { ...current }; delete next[lastPassed.item.id]; return next; });
    if (lastPassed.wasSaved) setSavedIds(current => current.includes(lastPassed.item.id) ? current : [...current, lastPassed.item.id]);
    if (lastPassed.wasSaved && lastPassed.item.mode === 'live') setSavedItems(current => [lastPassed.item, ...current.filter(item => item.id !== lastPassed.item.id)].slice(0, 100));
    setLastPassed(null);
  };

  if (!hydrated) return <SafeAreaView style={styles.safe}><View style={styles.loading}><Text style={styles.brand}>PB&B ✦</Text><Text style={styles.lead}>Getting your ideas ready…</Text></View></SafeAreaView>;
  return <SafeAreaView style={styles.safe}><StatusBar style="dark" />
    <View style={styles.header}><View><Text style={styles.brand}>PB&B <Text style={styles.brandStar}>✦</Text></Text><Text style={styles.brandSub}>Exploring {preferences.place || 'anywhere'}</Text></View><Pressable onPress={() => setTab('Settings')} style={styles.settingsButton} accessibilityRole="button" accessibilityLabel="Open settings"><Text style={styles.settingsButtonText}>⚙  Settings</Text></Pressable></View>
    <ScrollView key={selected?.id ?? tab} style={styles.content} contentContainerStyle={styles.contentInner} keyboardShouldPersistTaps="handled">
      {!selected && lastPassed && <View style={styles.undoBanner}><Text style={styles.undoText}>Passed on {lastPassed.item.title}</Text><Pressable onPress={undoPass}><Text style={styles.undoLink}>Undo</Text></Pressable></View>}
      {selected ? <View>
        <Pressable onPress={() => setSelected(null)}><Text style={styles.back}>‹ Back to exploring</Text></Pressable>
        {selected.mode !== 'live' && sampleImages[selected.id] ? <ImageBackground source={sampleImages[selected.id]} style={styles.detailPhoto}><Text style={styles.photoLabel}>ILLUSTRATIVE PHOTO</Text></ImageBackground> : <View style={[styles.detailArt, { backgroundColor: selected.accent }]}><Text style={[styles.detailGlyph, { color: selected.accent === '#103D46' ? '#F5F8F7' : '#103D46' }]}>✦</Text><Text style={[styles.detailCategory, { color: selected.accent === '#103D46' ? '#F5F8F7' : '#103D46' }]}>{selected.category.toUpperCase()}</Text></View>}
        <Text style={styles.eyebrow}>{selected.format} · {formatDate(selected.startsAt)}</Text>
        <Text style={styles.h1}>{selected.title}</Text><Text style={styles.lead}>{selected.summary}</Text>
        <View style={styles.infoPanel}><Text style={styles.infoText}>⌖  {selected.location} · about {formatDistance(selected.distanceKm, preferences.distanceUnit)} from {selected.mode === 'live' ? preferences.place : 'Toronto'}</Text><Text style={styles.infoText}>◷  Starts {formatDate(selected.startsAt)} · {selected.durationHours} hours</Text><Text style={styles.infoText}>$  {money(selected.totalCost, selected.currency)} listed cost</Text></View>
        <Text style={styles.notice}>Before leaving, confirm the date, time, price, availability, weather policy and location with the organizer. Activities can fill, sell out, close or change without notice. PB&B and AI can make mistakes.</Text>
        {selected.mode === 'live' && selected.sourceUrl?.startsWith('https://') ? <Action label="Check the listing source ↗" onPress={() => Linking.openURL(selected.sourceUrl!)} /> : <Text style={styles.notice}>This is a sample idea without a verified source or booking link.</Text>}
        {selected.mode === 'live' && selected.verifiedAt ? <Text style={styles.helper}>Source last checked {formatDate(selected.verifiedAt)}. Confirm current details with the organizer.</Text> : null}
        <Action label={savedIds.includes(selected.id) ? 'Remove from saved' : 'Save for later'} onPress={() => toggleSaved(selected)} />
      </View> : tab === 'Discover' ? <View>
        <ImageBackground source={require('./assets/discovery-hero-v2.png')} style={styles.heroImage} imageStyle={styles.heroImageCorners}><Text style={styles.heroKicker}>MAKE A STORY OF IT</Text><Text style={styles.heroTitle}>{'Find the\nunexpected.'}</Text></ImageBackground>
        <View style={styles.homeIntro}><View style={styles.homeIntroText}><Text style={styles.sectionKicker}>LOCAL INSPIRATION</Text><Text style={styles.homeTitle}>{showingTorontoSamples ? 'Toronto ideas.' : `${preferences.place.split(',')[0].trim() || 'Local'} ideas.`}</Text></View><Pressable onPress={() => setTab('Settings')} style={styles.placeButton}><Text style={styles.placeButtonText}>⌖  Change place</Text></Pressable></View>
        <Text style={styles.homeLead}>{showingTorontoSamples ? 'Three Toronto sample ideas and two sponsored placement previews. These are examples, not confirmed events.' : remoteItems.length ? `Ideas for ${preferences.place}. Open each source to check current details.` : `No source-linked ideas for ${preferences.place} yet. The live web scout is being connected.`}</Text>
        {autoScoutStatus ? <Text style={styles.scoutStatus}>✦  {autoScoutStatus}</Text> : null}
        <Pressable onPress={() => setSearchOpen(value => !value)} style={styles.searchToggle} accessibilityRole="button" accessibilityState={{ expanded: searchOpen }}><Text style={styles.searchToggleText}>⌕  Search and refine</Text><Text style={styles.searchChevron}>{searchOpen ? '−' : '+'}</Text></Pressable>
        {searchOpen && <View style={styles.searchPanel}>
          <TextInput value={query} onChangeText={setQuery} placeholder="Search ideas: dance, pottery, outdoors…" placeholderTextColor="#6C8285" style={styles.search} returnKeyType="search" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}><Pill label="All" active={category === 'All'} onPress={() => setCategory('All')} />{categories.map(value => <Pill key={value} label={value} active={category === value} onPress={() => setCategory(value)} />)}</ScrollView>
          <View style={styles.agentPanel}><Text style={styles.agentKicker}>✦ YOUR PERSONAL SCOUT</Text><Text style={styles.agentTitle}>What are you up for?</Text><Text style={styles.agentLead}>{remoteScoutConfigured ? 'Try a free hour, a new skill, or a little adventure.' : 'Preview mode: this searches sample ideas. Live AI is not connected yet.'}</Text>
            <TextInput value={agentPrompt} onChangeText={setAgentPrompt} onSubmitEditing={() => runScout(agentPrompt)} placeholder="Try “free dance class this weekend”" placeholderTextColor="#68868B" style={styles.agentInput} returnKeyType="search" />
            <Action label="Find ideas" onPress={() => runScout(agentPrompt)} />
            {scoutMessage ? <Text style={styles.helper}>{scoutCitations.length ? 'Source-linked ideas are below.' : scoutMessage}</Text> : null}
            <View style={styles.promptRow}>{['Free this weekend', 'Something creative', 'Surprise me'].map(prompt => <Pressable key={prompt} onPress={() => { setAgentPrompt(prompt); runScout(prompt); }} style={styles.promptChip}><Text style={styles.promptText}>{prompt}</Text></Pressable>)}</View>
          </View>
          {activeRequest !== null && <View style={styles.agentResults}><View style={styles.rowBetween}><Text style={styles.subheading}>A few ideas for you</Text><Pressable onPress={() => { setActiveRequest(null); setAgentPrompt(''); }}><Text style={styles.clearText}>Clear</Text></Pressable></View>
            <Text style={styles.resultIntro}>{activeRequest.trim() ? `For “${activeRequest.trim()}”` : 'Based on your interests and practical limits'}</Text>
            {scoutCitations.length ? <CitedScoutText message={scoutMessage} citations={scoutCitations} /> : scoutMessage ? <Text style={styles.notice}>{scoutMessage}</Text> : null}
            {scoutLoading ? <Text style={styles.notice}>Your scout is looking…</Text> : scoutCitations.length ? null : agentSuggestions.length ? agentSuggestions.map(suggestion => <View key={suggestion.item.id}><Text style={styles.whyText}>WHY IT FITS · {suggestion.reasons.join(' · ')}</Text>{itemCard(suggestion.item)}</View>) : <View style={styles.empty}><Text style={styles.emptyTitle}>{showingTorontoSamples && !remoteScoutConfigured ? 'No close match in these sample ideas.' : `No verified match for ${preferences.place} yet.`}</Text><Text style={styles.summary}>{showingTorontoSamples && !remoteScoutConfigured ? 'Try another interest, more time, a larger budget, or a wider radius.' : 'Try another interest or adjust your budget or radius. Real listings need verified organizer sources.'}</Text></View>}
            <View style={styles.chipRow}><Pill label="Something different" active={agentMode === 'different'} onPress={() => runScout(activeRequest, 'different')} /><Pill label="Cheaper" active={agentMode === 'cheaper'} onPress={() => runScout(activeRequest, 'cheaper')} /><Pill label="Closer" active={agentMode === 'closer'} onPress={() => runScout(activeRequest, 'closer')} /></View>
          </View>}
        </View>}
        <Pressable onPress={() => setSerendipityOpen(value => !value)} style={styles.serendipityToggle} accessibilityRole="button" accessibilityState={{ expanded: serendipityOpen }}><View><Text style={styles.serendipityTitle}>✦  Serendipity</Text><Text style={styles.serendipitySubtitle}>Let something wonderful find you</Text></View><Text style={styles.serendipityChevron}>{serendipityOpen ? '−' : '+'}</Text></Pressable>
        {serendipityOpen && <View style={styles.serendipityPanel}>
          <Text style={styles.label}>How would you get there?</Text><View style={styles.chipRow}>{(preferences.travelModes ?? []).map(mode => <Pill key={mode} label={travelModeLabels[mode]} active={travelMode === mode} onPress={() => { setTravelMode(mode); setSerendipityPick(null); setSerendipityTried(false); }} />)}</View>
          {!preferences.travelModes.length && <Text style={styles.notice}>Choose a way to travel in Settings first.</Text>}
          <Text style={styles.serendipityRule}>{travelMode === 'walk' ? `A nearby surprise, within ${formatDistance(5, preferences.distanceUnit)}.` : travelMode === 'plane' ? 'Only activities with a verified flight shorter than two hours from your chosen city.' : `A surprise within ${formatDistance(100, preferences.distanceUnit)}. Check the ${travelMode === 'train' ? 'train route' : travelMode === 'ferry' || travelMode === 'boat' ? 'sailing route' : 'route'} before going.`}</Text>
          {travelMode === 'plane' && <ImageBackground source={require('./assets/polar-bear-inspiration.png')} style={styles.planeTeaser} imageStyle={styles.heroImageCorners}><View style={styles.planeTeaserShade}><Text style={styles.planeTeaserKicker}>INSPIRATION ONLY</Text><Text style={styles.planeTeaserTitle}>The kind of story worth travelling for.</Text></View></ImageBackground>}
          {travelMode === 'plane' && <Text style={styles.helper}>Polar bears are an inspiration, not a current trip suggestion. A flight and activity must both be source-checked before they can appear here.</Text>}
          {preferences.travelModes.length > 0 && <Action label="Surprise me" onPress={drawSerendipity} />}
          {serendipityPick && <View><Text style={styles.whyText}>YOUR {travelMode.toUpperCase()} SURPRISE · SAMPLE IDEA</Text>{itemCard(serendipityPick)}</View>}
          {serendipityTried && !serendipityPick && <Text style={styles.notice}>{travelMode === 'plane' ? `No source-checked activity with a flight under two hours from ${preferences.place} is connected yet.` : `No ${travelMode} idea fits your budget and location yet. Try another way to travel or change Settings.`}</Text>}
        </View>}
        {alerts.length > 0 && <Pressable onPress={() => setTab('Settings')} style={styles.alertBanner}><Text style={styles.alertBannerTitle}>✦ {alerts.length} timely {alerts.length === 1 ? 'find' : 'finds'} for you</Text><Text style={styles.alertBannerBody}>See what fits your interests →</Text></Pressable>}
        <View style={styles.rowBetween}><Text style={styles.subheading}>{showDiverse ? 'A different direction' : showingTorontoSamples ? 'Toronto sample ideas' : 'Local ideas for you'}</Text><Text style={styles.resultCount}>{homeOrganicItems.length} shown</Text></View>
        {catalogLoading ? <Text style={styles.notice}>Loading ideas…</Text> : homeOrganicItems.length ? homeOrganicItems.map(item => <View key={item.id}><Text style={styles.whyText}>{fitReason(item)}</Text>{itemCard(item)}</View>) : <View style={styles.empty}><Text style={styles.emptyTitle}>No ideas here yet.</Text><Text style={styles.summary}>{remoteScoutConfigured ? 'Try another interest, budget, or travel radius in Settings.' : 'Live web discoveries are not connected in this preview yet.'}</Text></View>}
        {sponsoredPreviews.length > 0 && <View style={styles.sponsoredSection}><View style={styles.rowBetween}><Text style={styles.sponsoredKicker}>SPONSORED SPOTS</Text><Text style={styles.sponsoredPreview}>PREVIEW</Text></View><Text style={styles.sponsoredDisclosure}>Two examples of paid placement. No partner has paid for these sample listings; sponsorship does not affect the ideas above.</Text>{sponsoredPreviews.map(itemCard)}</View>}
        {!showMoreIdeas && organicItems.length > 3 && !searchOpen && <Action label="See more local ideas" onPress={() => setShowMoreIdeas(true)} secondary />}
        <Action label={showDiverse ? 'Back to your picks' : 'Show me something different'} onPress={() => setShowDiverse(value => !value)} secondary />
        <Text style={styles.footerNote}>Example photos are illustrative. Check an organizer's source before travelling to a real event.</Text>
      </View> : tab === 'Now' ? <View>
        <Text style={styles.sectionKicker}>SPONTANEOUS</Text><Text style={styles.h1}>Have a little time?</Text><Text style={styles.lead}>Find something that fits your day and your budget.</Text>
        <Text style={styles.label}>Time available</Text><View style={styles.chipRow}>{[1, 2, 3, 5].map(value => <Pill key={value} label={`${value} hr`} active={timeHours === value} onPress={() => setTimeHours(value)} />)}</View>
        {ranked.filter(item => item.durationHours <= timeHours && daysUntil(item.startsAt) <= 2).map(itemCard)}
        {!ranked.some(item => item.durationHours <= timeHours && daysUntil(item.startsAt) <= 2) && <Text style={styles.notice}>No sample idea fits the next two days. Try more time or adjust your preferences.</Text>}
      </View> : tab === 'Along the Way' ? <View>
        <Text style={styles.sectionKicker}>A LITTLE DETOUR</Text><Text style={styles.h1}>Along the way.</Text><Text style={styles.lead}>See sample stops that could add a memorable pause to a journey.</Text>
        <TextInput value={destination} onChangeText={setDestination} placeholder="Where are you heading?" placeholderTextColor="#6C8285" style={styles.search} />
        <Text style={styles.notice}>Route matching is coming next. Toronto sample stops appear only when exploring Toronto; entering a destination does not calculate a route.</Text>
        {ranked.filter(item => item.alongWay).map(itemCard)}
      </View> : tab === 'Saved' ? <View>
        <Text style={styles.sectionKicker}>YOUR SHORTLIST</Text><Text style={styles.h1}>Saved for later.</Text><Text style={styles.lead}>Keep possibilities close across places. Recheck each live source before making plans.</Text>
        {savedVisible.map(itemCard)}
        {!savedVisible.length && <View style={styles.empty}><Text style={styles.emptyTitle}>No saved ideas yet.</Text><Text style={styles.summary}>Save an experience from Discover to find it here.</Text><Action label="Explore ideas" onPress={() => setTab('Discover')} small /></View>}
      </View> : <View>
        <Text style={styles.sectionKicker}>MAKE IT YOURS</Text><Text style={styles.h1}>Settings.</Text><Text style={styles.lead}>Choose your place, interests and practical limits. Changes are saved on this device.</Text>
        <Text style={styles.subheading}>Exploring</Text>
        <Action label={locationBusy ? 'Finding nearby city…' : 'Use my current location'} onPress={() => { if (!locationBusy) void useCurrentLocation(); }} secondary />
        {locationDenied && <Action label="Open phone location settings" onPress={() => { void Linking.openSettings(); }} secondary />}
        {locationMessage ? <Text style={styles.helper}>{locationMessage}</Text> : <Text style={styles.helper}>Location is used only when you tap the button. You can always choose another place.</Text>}
        <TextInput value={preferences.place} onChangeText={place => setPreferences(current => ({ ...current, place }))} placeholder="City and country" placeholderTextColor="#6C8285" style={styles.search} />
        <Pressable onPress={() => setCurrencyOpen(value => !value)} style={styles.searchToggle}><Text style={styles.searchToggleText}>Currency · {preferences.currency} {currencyName(preferences.currency)}</Text><Text style={styles.searchChevron}>{currencyOpen ? '−' : '+'}</Text></Pressable>
        {suggestedCurrency && <Text style={styles.helper}>Suggested for your current location: {suggestedCurrency}. You can choose any currency.</Text>}
        {currencyOpen && <View style={styles.searchPanel}>
          <TextInput value={currencyQuery} onChangeText={setCurrencyQuery} placeholder="Search currency name or code" placeholderTextColor="#6C8285" style={styles.search} autoCapitalize="none" />
          <View style={styles.chipRow}>{currencyOptions(currencyQuery, preferences.currency, suggestedCurrency).map(code => <Pill key={code} label={`${code} · ${currencyName(code)}`} active={preferences.currency === code} onPress={() => { setPreferences(current => ({ ...current, currency: code })); setCurrencyOpen(false); setCurrencyQuery(''); }} />)}</View>
          <Text style={styles.helper}>Showing {currencyQuery.trim() ? 'search matches' : 'common currencies'}. Search to find other currencies.</Text>
        </View>}
        <Text style={styles.subheading}>Interests</Text><View style={styles.chipRow}>{categories.map(value => <Pill key={value} label={value} active={preferences.interests.includes(value)} onPress={() => toggleInterest(value)} />)}</View>
        <Pressable onPress={() => setTopicsOpen(value => !value)} style={styles.searchToggle}><Text style={styles.searchToggleText}>Specific interests · {preferences.topics.length} selected</Text><Text style={styles.searchChevron}>{topicsOpen ? '−' : '+'}</Text></Pressable>
        {topicsOpen && topicGroups.map(group => <View key={group.label}><Pressable onPress={() => setTopicGroupOpen(open => open === group.label ? null : group.label)} style={styles.searchToggle}><Text style={styles.searchToggleText}>{group.label} · {group.topics.filter(topic => preferences.topics.includes(topic)).length}</Text><Text style={styles.searchChevron}>{topicGroupOpen === group.label ? '−' : '+'}</Text></Pressable>{topicGroupOpen === group.label && <View style={styles.chipRow}>{group.topics.map(topic => <Pill key={topic} label={topic} active={preferences.topics.includes(topic)} onPress={() => toggleTopic(topic)} />)}</View>}</View>)}
        {topicsOpen && <Text style={styles.helper}>“Open to new ideas” lifts surprising picks in Discover; alerts still use your specific interests.</Text>}
        <Text style={styles.subheading}>Ways you like to travel</Text><View style={styles.chipRow}>{travelModes.map(mode => <Pill key={mode} label={travelModeLabels[mode]} active={preferences.travelModes.includes(mode)} onPress={() => toggleTravel(mode)} />)}</View>
        <Text style={styles.helper}>Serendipity uses these choices. Routes and travel times need source checks before you leave.</Text>
        <View style={styles.settingsRow}><View><Text style={styles.label}>Maximum budget</Text><Text style={styles.helper}>Per experience, {preferences.currency}</Text></View><TextInput style={styles.numberInput} keyboardType="number-pad" value={String(preferences.maxBudget)} onChangeText={value => setNumber('maxBudget', value)} /></View>
        <Text style={styles.subheading}>Distance</Text><View style={styles.chipRow}><Pill label="Kilometres" active={preferences.distanceUnit === 'km'} onPress={() => setPreferences(current => ({ ...current, distanceUnit: 'km' }))} /><Pill label="Miles" active={preferences.distanceUnit === 'mi'} onPress={() => setPreferences(current => ({ ...current, distanceUnit: 'mi' }))} /></View>
        <View style={styles.settingsRow}><View><Text style={styles.label}>Travel radius</Text><Text style={styles.helper}>{preferences.distanceUnit === 'mi' ? 'Miles' : 'Kilometres'} from your chosen place</Text></View><TextInput style={styles.numberInput} keyboardType="number-pad" value={String(Math.round(fromKilometres(preferences.maxDistanceKm, preferences.distanceUnit)))} onChangeText={setRadius} /></View>
        <Setting label="Show timely in-app alerts" value={preferences.alertsEnabled} onPress={() => setPreferences(current => ({ ...current, alertsEnabled: !current.alertsEnabled }))} />
        <Setting label="Highlight free opportunities" value={preferences.freeAlerts} onPress={() => setPreferences(current => ({ ...current, freeAlerts: !current.freeAlerts }))} />
        <Setting label="Watch saved interests" value={preferences.savedAlerts} onPress={() => setPreferences(current => ({ ...current, savedAlerts: !current.savedAlerts }))} />
        <Setting label="Phone reminders for verified matches" value={preferences.phoneAlertsEnabled} onPress={togglePhoneAlerts} />
        <Text style={styles.helper}>When a source-checked match has a sign-up deadline or is coming up soon, your phone can remind you. Finding new ideas while the app is closed needs the daily web scout and push service.</Text>
        {phoneAlertMessage ? <Text style={styles.notice}>{phoneAlertMessage}</Text> : null}
        {preferences.phoneAlertsEnabled && <Action label="Try a sample phone alert" onPress={() => { sendSampleAlert().then(() => setPhoneAlertMessage('Sample alert scheduled in five seconds.')).catch(() => setPhoneAlertMessage('The sample alert could not be sent.')); }} secondary />}
        <Setting label="Daily scout for weekends and sign-up deadlines" value={preferences.dailyScoutEnabled} onPress={() => { void toggleDailyScout(); }} />
        <Text style={styles.helper}>{dailyScoutConfigured ? 'With your permission, the web scout checks each morning and sends at most two possible matches with source links.' : 'Daily web alerts are being built. This preview cannot send new finds while the app is closed yet.'}</Text>
        {dailyScoutMessage ? <Text style={styles.notice}>{dailyScoutMessage}</Text> : null}
        <Text style={styles.subheading}>Timely finds</Text>
        {alerts.length ? alerts.map(alert => <Pressable key={alert.item.id} onPress={() => setSelected(alert.item)} style={styles.alertCard}><Text style={styles.alertTag}>✦ {alert.reason}</Text><Text style={styles.alertTitle}>{alert.item.title}</Text><Text style={styles.cardMeta}>Starts {formatDate(alert.item.startsAt)} · {money(alert.item.totalCost, alert.item.currency)} · {formatDistance(alert.item.distanceKm, preferences.distanceUnit)}</Text><Text style={styles.alertLink}>See details →</Text></Pressable>) : <View style={styles.empty}><Text style={styles.emptyTitle}>No timely finds right now.</Text><Text style={styles.summary}>Enable alerts and choose interests to see matching sample opportunities.</Text></View>}
        <Text style={styles.notice}>Check each listing source and confirm details with the organizer before leaving. Events can fill, sell out, close due to weather, or change unexpectedly. AI can make mistakes. Opt-in phone reminders work for recently checked live listings already found by the app; new finds while the app is closed need a push service.</Text>
        <Action label="Clear passes and loves" onPress={() => setFeedback({})} secondary />
      </View>}
    </ScrollView>
    {!selected && <View style={styles.tabBar}>{tabs.map(value => <Pressable key={value} onPress={() => setTab(value)} style={styles.tab}><Text style={[styles.tabIcon, tab === value && styles.tabActive]}>{value === 'Discover' ? '✦' : value === 'Now' ? '◷' : value === 'Along the Way' ? '↗' : value === 'Saved' ? '♡' : '⚙'}</Text><Text style={[styles.tabText, tab === value && styles.tabActive]}>{value === 'Along the Way' ? 'Along' : value}</Text></Pressable>)}</View>}
  </SafeAreaView>;
}

function Setting({ label, value, onPress }: { label: string; value: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.setting}><Text style={styles.label}>{label}</Text><View style={[styles.toggle, value && styles.toggleOn]}><View style={[styles.toggleKnob, value && styles.toggleKnobOn]} /></View></Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F8F7' }, header: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: '#DCE8E4' },
  heroImage: { height: 156, borderRadius: 20, padding: 21, justifyContent: 'flex-end', marginBottom: 16, overflow: 'hidden' }, heroImageCorners: { borderRadius: 20 }, heroKicker: { color: '#B9ED5C', fontSize: 10, fontWeight: '900', letterSpacing: 1.6, marginBottom: 7 }, heroTitle: { color: '#FFFFFF', fontSize: 27, fontWeight: '900', lineHeight: 31, letterSpacing: -0.6, maxWidth: 190 },
  agentPanel: { backgroundColor: '#103D46', borderRadius: 23, padding: 22, marginBottom: 26, overflow: 'hidden' }, agentKicker: { color: '#B9ED5C', fontWeight: '900', letterSpacing: 1.4, fontSize: 11, marginBottom: 14 }, agentTitle: { color: '#FFFFFF', fontSize: 29, lineHeight: 34, fontWeight: '900', letterSpacing: -0.7, marginBottom: 8 }, agentLead: { color: '#E2F2EF', fontSize: 14, lineHeight: 20, marginBottom: 18 }, agentInput: { backgroundColor: '#FFFFFF', borderRadius: 12, color: ink, paddingHorizontal: 15, paddingVertical: 13, fontSize: 14, marginBottom: 10 }, promptRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, promptChip: { borderRadius: 18, backgroundColor: '#18565E', paddingHorizontal: 11, paddingVertical: 8 }, promptText: { color: '#F5F8F7', fontWeight: '700', fontSize: 11 }, agentResults: { marginBottom: 28 }, resultIntro: { color: muted, fontSize: 13, marginBottom: 15 }, whyText: { color: sea, fontWeight: '800', fontSize: 10, lineHeight: 15, letterSpacing: 0.4, marginBottom: 8 }, clearText: { color: sea, fontWeight: '800', fontSize: 12 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }, welcome: { padding: 24, paddingTop: 52, paddingBottom: 52, maxWidth: 650, width: '100%', alignSelf: 'center' }, welcomeTitle: { color: ink, fontSize: 38, lineHeight: 43, fontWeight: '900', letterSpacing: -1.5, marginBottom: 12 }, undoBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#E0F7F5', borderRadius: 12, padding: 13, marginBottom: 15 }, undoText: { color: ink, fontSize: 12, flex: 1, marginRight: 10 }, undoLink: { color: sea, fontWeight: '800', fontSize: 13 },
  brand: { color: ink, fontWeight: '900', fontSize: 25, letterSpacing: -1.5 }, brandStar: { color: '#18B8B0' }, brandSub: { color: muted, fontSize: 11, letterSpacing: 0.3 }, avatar: { backgroundColor: '#DDF6F3', height: 38, width: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: sea, fontWeight: '800', fontSize: 10 },
  content: { flex: 1 }, contentInner: { padding: 22, paddingBottom: 40, maxWidth: 800, width: '100%', alignSelf: 'center' }, sectionKicker: { color: sea, fontWeight: '800', letterSpacing: 2, fontSize: 11, marginBottom: 10 }, h1: { color: ink, fontSize: 34, lineHeight: 39, fontWeight: '800', letterSpacing: -1.2, marginBottom: 10 }, lead: { color: muted, fontSize: 15, lineHeight: 22, marginBottom: 24 },
  alertBanner: { backgroundColor: '#FFF0EA', borderRadius: 18, padding: 18, marginBottom: 20 }, alertBannerTitle: { color: '#103D46', fontWeight: '800', fontSize: 17 }, alertBannerBody: { color: '#375F62', marginTop: 5, fontSize: 13 }, search: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D7E5E2', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, color: ink, fontSize: 14, marginBottom: 18 }, chipScroll: { marginBottom: 22 }, chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 }, pill: { paddingHorizontal: 15, paddingVertical: 9, borderRadius: 22, borderWidth: 1, borderColor: '#C9DCDA', backgroundColor: '#FFFFFF', marginRight: 7, marginBottom: 3 }, pillActive: { backgroundColor: '#18B8B0', borderColor: '#18B8B0' }, pillText: { color: '#103D46', fontWeight: '700', fontSize: 12 }, pillTextActive: { color: '#103D46' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, subheading: { color: ink, fontWeight: '800', fontSize: 21, marginBottom: 14 }, resultCount: { color: muted, fontSize: 12 }, card: { borderRadius: 20, backgroundColor: '#FFFFFF', overflow: 'hidden', borderWidth: 1, borderColor: '#E0ECE8', marginBottom: 18 }, cardArt: { height: 110, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }, artGlyph: { color: '#FFFFFF', opacity: 0.9, fontSize: 72, lineHeight: 80, fontWeight: '200' }, artLabel: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', letterSpacing: 2 }, cardBody: { padding: 17 }, eyebrow: { color: sea, textTransform: 'uppercase', fontWeight: '800', fontSize: 10, letterSpacing: 0.9 }, cost: { color: ink, fontWeight: '800', fontSize: 12 }, cardTitle: { color: ink, fontWeight: '800', fontSize: 21, lineHeight: 26, marginTop: 8, marginBottom: 5 }, cardMeta: { color: muted, fontSize: 12, marginBottom: 10 }, summary: { color: '#45656B', fontSize: 14, lineHeight: 20 }, cardActions: { marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7 }, action: { backgroundColor: '#B9ED5C', borderRadius: 999, paddingHorizontal: 17, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }, actionSecondary: { backgroundColor: '#E9F9F5', borderWidth: 1, borderColor: '#C9E7E0' }, actionSmall: { paddingHorizontal: 12, paddingVertical: 10, marginBottom: 0 }, actionText: { color: '#103D46', fontWeight: '800', fontSize: 13 }, actionTextSecondary: { color: sea }, textAction: { paddingHorizontal: 6, paddingVertical: 10 }, textActionLabel: { color: sea, fontWeight: '700', fontSize: 12 },
  empty: { padding: 22, backgroundColor: '#FFFFFF', borderRadius: 18, marginBottom: 20 }, emptyTitle: { color: ink, fontWeight: '800', fontSize: 17, marginBottom: 6 }, footerNote: { color: '#61767A', fontSize: 11, textAlign: 'center', marginTop: 14 }, label: { color: ink, fontSize: 14, fontWeight: '700', marginBottom: 6 }, helper: { color: muted, fontSize: 11 }, notice: { backgroundColor: '#EAF6F4', color: '#103D46', borderRadius: 12, padding: 14, lineHeight: 19, fontSize: 12, marginBottom: 20 },
  back: { color: sea, fontWeight: '700', marginBottom: 18 }, detailArt: { borderRadius: 18, height: 190, alignItems: 'center', justifyContent: 'center', marginBottom: 22 }, detailGlyph: { color: '#FFFFFF', fontSize: 100, lineHeight: 110 }, detailCategory: { color: '#FFFFFF', fontWeight: '900', letterSpacing: 2 }, infoPanel: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, marginBottom: 20 }, infoText: { color: ink, fontSize: 14, marginBottom: 10 },
  alertCard: { backgroundColor: '#FFF0EA', padding: 18, borderRadius: 16, marginBottom: 12 }, alertTag: { color: '#BB4A34', fontWeight: '800', textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.8 }, alertTitle: { color: ink, fontSize: 17, fontWeight: '800', marginVertical: 8 }, alertLink: { color: sea, fontWeight: '800', fontSize: 12 }, settingsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderColor: '#E3E7E3' }, numberInput: { width: 76, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#C9DCDA', borderRadius: 10, textAlign: 'center', padding: 9, color: ink, fontWeight: '800' }, setting: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderColor: '#E3E7E3' }, toggle: { width: 44, height: 26, borderRadius: 13, backgroundColor: '#C9DCDA', padding: 3 }, toggleOn: { backgroundColor: '#18B8B0' }, toggleKnob: { width: 20, height: 20, backgroundColor: '#FFFFFF', borderRadius: 10 }, toggleKnobOn: { alignSelf: 'flex-end' },
  scoutStatus: { color: sea, fontSize: 11, fontWeight: '700', marginBottom: 12 }, deadlineText: { color: '#BB4A34', fontSize: 12, fontWeight: '800', marginBottom: 8 },
  homeIntro: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 8, marginBottom: 6 }, homeIntroText: { flex: 1 }, homeTitle: { color: ink, fontSize: 28, lineHeight: 32, fontWeight: '800', letterSpacing: -0.8 }, homeLead: { color: muted, fontSize: 13, lineHeight: 19, marginBottom: 16 }, placeButton: { paddingVertical: 8, paddingHorizontal: 9, borderRadius: 18, backgroundColor: '#E4F7F3', marginBottom: 4 }, placeButtonText: { color: sea, fontSize: 11, fontWeight: '800' },
  settingsButton: { backgroundColor: '#E1F4F0', borderRadius: 18, paddingHorizontal: 11, paddingVertical: 9 }, settingsButtonText: { color: sea, fontSize: 12, fontWeight: '800' }, searchToggle: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#C9DCDA', borderRadius: 16, paddingHorizontal: 17, paddingVertical: 14, marginBottom: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, searchToggleText: { color: ink, fontSize: 15, fontWeight: '800' }, searchChevron: { color: sea, fontSize: 23, lineHeight: 25, fontWeight: '500' }, searchPanel: { marginBottom: 14 },
  cardPhoto: { height: 180, justifyContent: 'flex-end', alignItems: 'flex-end', padding: 12 }, detailPhoto: { height: 230, borderRadius: 18, overflow: 'hidden', justifyContent: 'flex-end', alignItems: 'flex-end', padding: 12, marginBottom: 22 }, photoLabel: { color: '#FFFFFF', backgroundColor: 'rgba(16,61,70,0.78)', fontWeight: '800', fontSize: 9, letterSpacing: 0.8, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10 },
  serendipityToggle: { backgroundColor: '#B9ED5C', borderRadius: 18, paddingHorizontal: 18, paddingVertical: 15, marginBottom: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, serendipityTitle: { color: ink, fontSize: 17, fontWeight: '900' }, serendipitySubtitle: { color: ink, fontSize: 11, marginTop: 3 }, serendipityChevron: { color: ink, fontSize: 24 }, serendipityPanel: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D7E5E2', borderRadius: 18, padding: 17, marginBottom: 20 }, serendipityRule: { color: muted, fontSize: 13, lineHeight: 19, marginBottom: 12 },
  planeTeaser: { height: 170, borderRadius: 18, overflow: 'hidden', justifyContent: 'flex-end', marginBottom: 10 }, planeTeaserShade: { backgroundColor: 'rgba(16,61,70,0.72)', padding: 14 }, planeTeaserKicker: { color: '#B9ED5C', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 }, planeTeaserTitle: { color: '#FFFFFF', fontSize: 18, lineHeight: 22, fontWeight: '900', maxWidth: 220, marginTop: 4 },
  sponsoredSection: { backgroundColor: '#E7F3F0', borderRadius: 21, padding: 14, marginBottom: 20 }, sponsoredKicker: { color: sea, fontSize: 10, fontWeight: '900', letterSpacing: 1.3 }, sponsoredPreview: { color: sea, fontSize: 10, fontWeight: '900', backgroundColor: '#B9ED5C', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 12 }, sponsoredDisclosure: { color: muted, fontSize: 11, lineHeight: 16, marginVertical: 10 },
  tabBar: { flexDirection: 'row', borderTopWidth: 1, borderColor: '#DCE8E4', backgroundColor: '#FFFFFF', paddingBottom: 5, paddingTop: 6 }, tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 }, tabIcon: { color: '#667F82', fontSize: 22 }, tabText: { color: '#667F82', fontSize: 10, fontWeight: '700' }, tabActive: { color: sea },
});
