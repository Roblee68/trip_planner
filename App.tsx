import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useIncomingShare } from 'expo-sharing';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, ImageBackground, Linking, Platform, ScrollView, StyleSheet, Text, TextInput, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { categories, daysUntil, defaultPreferences, interestTopics, matchedTopics, money, namedInterestSuggestions, normalizeTopics, opportunityAlerts, rankExperiences, topicGroups, travelModeLabels, travelModes, type Category, type Experience, type Feedback, type Preferences, type InterestTopic, type TravelMode } from './src/logic';
import { currencyForCountry, currencyName, currencyOptions } from './src/currencies';
import { formatDistance, fromKilometres, toKilometres } from './src/units';
import { catalog } from './src/catalog';
import { sampleExperiences } from './src/sampleData';
import { chooseSerendipity, surpriseSearchPreferences } from './src/serendipity';
import { planReminders } from './src/reminders';
import { listenForSourceTaps, phoneAlertsAllowed, requestPhoneAlerts, sendSampleAlert, syncImportedReminders, syncPhoneReminders } from './src/phoneAlerts';
import { dailyScoutConfigured, getDailyPushToken, saveDailyScoutSubscription } from './src/dailyScout';
import { interpretIntent, recommendForIntent, type DiscoveryMode } from './src/agent';
import { askRemoteScout, pickToExperience, remoteScoutConfigured, scanSharedFind, type RouteSearch, type ScoutCitation, type WebIdea } from './src/remoteScout';
import { localInputParts, parseLocalDate, parseLocalDateTime, reminderSuggestion, safeSourceUrl, type ExtractedFind, type ImportedFind } from './src/importedFinds';
import { addImportedFindToCalendar, keepImportedScreenshot, removeImportedScreenshot } from './src/importActions';

type Tab = 'Discover' | 'Now' | 'Along the Way' | 'Saved' | 'Settings';
type NowFocus = 'Anything' | 'Outdoors' | 'Creative' | 'Food' | 'Unexpected';
type RouteFocus = 'Best stop' | 'Views' | 'Food' | 'Culture' | 'Unexpected';
type LikedExample = { id: string; title: string };
type StoredState = { preferences: Preferences; feedback: Feedback; savedIds: string[]; savedItems: Experience[]; savedWebIdeas: WebIdea[]; importedFinds: ImportedFind[]; likedExamples: LikedExample[] };
const STORAGE_KEY = 'pbb-local-state-v1';
const tabs: Tab[] = ['Discover', 'Now', 'Along the Way', 'Saved', 'Settings'];
const nowFocuses: NowFocus[] = ['Anything', 'Outdoors', 'Creative', 'Food', 'Unexpected'];
const routeFocuses: RouteFocus[] = ['Best stop', 'Views', 'Food', 'Culture', 'Unexpected'];
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
type FeaturedDestination = { id: string; title: string; place: string; summary: string; timing: string; price: string; sourceUrl: string; sourceName: string; imageUrl?: string; imageCredit?: string; fallbackImage: number };
const featuredDestinations: FeaturedDestination[] = [
  {
    id: 'visions-of-magic', title: 'Harry Potter: Visions of Magic', place: 'Toronto · YZD, 30 Hanover Rd',
    summary: 'Explore an interactive wizarding world art experience. Allow about 45 minutes and choose a timed entry.',
    timing: 'Now open · timed tickets', price: 'From CAD $28 + taxes and fees',
    sourceUrl: 'https://harrypottervisionsofmagic.com/ca/', sourceName: 'Harry Potter: Visions of Magic',
    imageUrl: 'https://harrypottervisionsofmagic.com/ca/wp-content/uploads/sites/6/2023/08/Homepage-Main-Header.jpeg',
    fallbackImage: require('./assets/wizard-experience-fallback.jpg'),
  },
  {
    id: 'muskoka-dog-sledding', title: 'Drive a dog sled through Muskoka', place: 'Huntsville · North Ridge Ranch',
    summary: 'Learn to mush your own team on private forest trails. Choose a one-hour or half-day guided tour.',
    timing: 'Winter 2026/27 reservations open', price: 'One-hour tour from CAD $229 + HST per adult',
    sourceUrl: 'https://www.northridgeranch.ca/tours', sourceName: 'North Ridge Ranch',
    imageUrl: 'https://images.squarespace-cdn.com/content/v1/64c921013fc0dc392373ec93/69f04d51-500c-4677-a163-e787f0b2546d/North%2BRidge%2BRanch%2B1.jpg',
    fallbackImage: require('./assets/dog-sled-fallback.jpg'),
  },
  {
    id: 'churchill-polar-bears', title: 'Churchill polar bear adventure', place: 'Churchill, Manitoba · depart Winnipeg',
    summary: 'Spend five nights exploring Churchill, including two full days watching wildlife from a Tundra Buggy.',
    timing: 'October–November 2027 departures', price: 'Paid tour · ask operator for price',
    sourceUrl: 'https://frontiersnorth.com/adventures/polar-bears/classic-churchill-polar-bear-adventure/', sourceName: 'Frontiers North Adventures',
    imageUrl: 'https://frontiersnorthadv.directus.app/assets/94a05f20-8de5-4582-8691-1eb46e932b23',
    imageCredit: 'Robin Biswas / Frontiers North', fallbackImage: require('./assets/polar-bear-fallback.jpg'),
  },
];

function FeaturedDestinationCard({ destination }: { destination: FeaturedDestination }) {
  const [useFallback, setUseFallback] = useState(!destination.imageUrl);
  return <View style={styles.featuredCard}>
    <ImageBackground source={useFallback ? destination.fallbackImage : { uri: destination.imageUrl! }} onError={() => setUseFallback(true)} style={styles.featuredPhoto} imageStyle={styles.heroImageCorners}>
      <Text style={styles.photoLabel}>{useFallback ? 'AI ILLUSTRATION' : `PHOTO: ${destination.imageCredit ?? destination.sourceName}`}</Text>
    </ImageBackground>
    <View style={styles.featuredCardBody}>
      <Text style={styles.featuredCardLabel}>REAL EXPERIENCE · PAID</Text>
      <Text style={styles.cardTitle}>{destination.title}</Text>
      <Text style={styles.summary}>{destination.summary}</Text>
      <Text style={styles.featuredDetail}>{destination.place}</Text>
      <Text style={styles.featuredDetail}>{destination.timing}</Text>
      <Text style={styles.featuredPrice}>{destination.price}</Text>
      <Pressable style={[styles.action, styles.actionSmall, styles.featuredLink]} accessibilityRole="link" onPress={() => { void Linking.openURL(destination.sourceUrl); }}><Text style={styles.actionText}>Official details ↗</Text></Pressable>
    </View>
  </View>;
}

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
  const sources = [...new Map(citations.map(citation => [citation.url, citation])).values()];
  for (const [index, citation] of citations.entries()) {
    if (citation.startIndex < cursor || citation.endIndex > message.length) continue;
    parts.push(<Text key={`text-${index}`}>{message.slice(cursor, citation.startIndex)}</Text>);
    parts.push(<Text key={`link-${index}`} style={styles.alertLink} onPress={() => { void Linking.openURL(citation.url); }}>{message.slice(citation.startIndex, citation.endIndex)}</Text>);
    cursor = citation.endIndex;
  }
  parts.push(<Text key="end">{message.slice(cursor)}</Text>);
  return <View style={styles.notice}><Text style={styles.summary}>{parts}</Text><Text style={styles.sourceHeading}>CHECK THE SOURCES</Text>{sources.map(source => <Pressable key={source.url} style={styles.sourceLink} accessibilityRole="link" onPress={() => { void Linking.openURL(source.url); }}><Text style={styles.sourceLinkText}>{source.title || 'Open source'} ↗</Text></Pressable>)}<Text style={styles.helper}>Confirm dates, availability, cost and weather with the organizer before leaving.</Text></View>;
}

class IncomingShareBoundary extends React.Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

function IncomingShare({ onReceive }: { onReceive: (imageUri: string | null, imageMime: string, url: string | null) => void }) {
  const handledShare = useRef<string | null>(null);
  const { sharedPayloads, resolvedSharedPayloads, isResolving, clearSharedPayloads, refreshSharePayloads } = useIncomingShare();
  useEffect(() => {
    if (!sharedPayloads.length) { handledShare.current = null; return; }
    if (isResolving) return;
    const key = JSON.stringify(sharedPayloads.map(item => [item.shareType, item.value]));
    if (handledShare.current === key) return;
    handledShare.current = key;
    const image = resolvedSharedPayloads.find(item => item.contentType === 'image');
    const rawImage = sharedPayloads.find(item => item.shareType === 'image');
    const text = sharedPayloads.filter(item => item.shareType === 'text' || item.shareType === 'url').map(item => item.value).join(' ');
    const url = safeSourceUrl(text.match(/https:\/\/[^\s]+/i)?.[0]?.replace(/[),.;]+$/, '') ?? '');
    const imageUri = image?.contentUri ?? rawImage?.value ?? null;
    if (imageUri || url) onReceive(imageUri, image?.contentMimeType ?? rawImage?.mimeType ?? 'image/png', url);
    clearSharedPayloads();
    void refreshSharePayloads();
  }, [sharedPayloads, resolvedSharedPayloads, isResolving, refreshSharePayloads, onReceive]);
  return null;
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
  const [savedWebIdeas, setSavedWebIdeas] = useState<WebIdea[]>([]);
  const [importedFinds, setImportedFinds] = useState<ImportedFind[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [importLink, setImportLink] = useState('');
  const [importImageUri, setImportImageUri] = useState<string | null>(null);
  const [importImageMime, setImportImageMime] = useState<string>('image/png');
  const [importCandidates, setImportCandidates] = useState<ExtractedFind[]>([]);
  const [importBusy, setImportBusy] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [editingImportId, setEditingImportId] = useState<string | null>(null);
  const [importTitle, setImportTitle] = useState('');
  const [importDateText, setImportDateText] = useState('');
  const [importEventDate, setImportEventDate] = useState('');
  const [importEventTime, setImportEventTime] = useState('');
  const [importVenue, setImportVenue] = useState('');
  const [importPlace, setImportPlace] = useState('');
  const [importReminderDate, setImportReminderDate] = useState('');
  const [importReminderTime, setImportReminderTime] = useState('');
  const [likedExamples, setLikedExamples] = useState<LikedExample[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [lastPassed, setLastPassed] = useState<{ item: Experience; wasSaved: boolean } | null>(null);
  const [experiences, setExperiences] = useState<Experience[]>(remoteScoutConfigured ? [] : sampleExperiences);
  const [catalogLoading, setCatalogLoading] = useState(remoteScoutConfigured);
  const [selected, setSelected] = useState<Experience | null>(null);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [showMoreIdeas, setShowMoreIdeas] = useState(false);
  const [discoverWide, setDiscoverWide] = useState(false);
  const [topicsOpen, setTopicsOpen] = useState(false);
  const [topicGroupOpen, setTopicGroupOpen] = useState<string | null>(null);
  const [customInterestText, setCustomInterestText] = useState('');
  const [customInterestMessage, setCustomInterestMessage] = useState('');
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [currencyQuery, setCurrencyQuery] = useState('');
  const [suggestedCurrency, setSuggestedCurrency] = useState<string | undefined>();
  const [serendipityOpen, setSerendipityOpen] = useState(false);
  const [travelMode, setTravelMode] = useState<TravelMode>('walk');
  const [serendipityPick, setSerendipityPick] = useState<Experience | null>(null);
  const [serendipityWebPick, setSerendipityWebPick] = useState<WebIdea | null>(null);
  const [serendipityTried, setSerendipityTried] = useState(false);
  const [serendipityLoading, setSerendipityLoading] = useState(false);
  const [serendipityMessage, setSerendipityMessage] = useState('');
  const [category, setCategory] = useState<Category | 'All'>('All');
  const [showDiverse, setShowDiverse] = useState(false);
  const [timeHours, setTimeHours] = useState(2);
  const [nowFocus, setNowFocus] = useState<NowFocus>('Anything');
  const [nowBudgetText, setNowBudgetText] = useState(String(defaultPreferences.maxBudget));
  const [nowIdeas, setNowIdeas] = useState<WebIdea[]>([]);
  const [nowMessage, setNowMessage] = useState('');
  const [nowLoading, setNowLoading] = useState(false);
  const [nowSearched, setNowSearched] = useState(false);
  const [destination, setDestination] = useState('');
  const [routeStyle, setRouteStyle] = useState<RouteSearch['style']>('either');
  const [routeVia, setRouteVia] = useState('');
  const [detourMinutes, setDetourMinutes] = useState(30);
  const [routeTiming, setRouteTiming] = useState<RouteSearch['timing']>('flexible');
  const [routeFocus, setRouteFocus] = useState<RouteFocus>('Best stop');
  const [routeIdeas, setRouteIdeas] = useState<WebIdea[]>([]);
  const [routeMessage, setRouteMessage] = useState('');
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeSearched, setRouteSearched] = useState(false);
  const [agentPrompt, setAgentPrompt] = useState('');
  const [activeRequest, setActiveRequest] = useState<string | null>(null);
  const [agentMode, setAgentMode] = useState<DiscoveryMode>('balanced');
  const [remoteSuggestions, setRemoteSuggestions] = useState<{ item: Experience; reason: string }[]>([]);
  const [remoteItems, setRemoteItems] = useState<Experience[]>([]);
  const [homeWebIdeas, setHomeWebIdeas] = useState<WebIdea[]>([]);
  const [searchWebIdeas, setSearchWebIdeas] = useState<WebIdea[]>([]);
  const [scoutLoading, setScoutLoading] = useState(false);
  const [scoutMessage, setScoutMessage] = useState('');
  const [scoutCitations, setScoutCitations] = useState<ScoutCitation[]>([]);
  const [autoScoutStatus, setAutoScoutStatus] = useState('');
  const [homeScoutMessage, setHomeScoutMessage] = useState('');
  const [homeScoutCitations, setHomeScoutCitations] = useState<ScoutCitation[]>([]);
  const [homeLoading, setHomeLoading] = useState(false);
  const [savedScoutIdeas, setSavedScoutIdeas] = useState<WebIdea[]>([]);
  const [savedScoutMessage, setSavedScoutMessage] = useState('');
  const [savedScoutLoading, setSavedScoutLoading] = useState(false);
  const [savedScoutSeed, setSavedScoutSeed] = useState('');
  const [phoneAlertMessage, setPhoneAlertMessage] = useState('');
  const [dailyScoutMessage, setDailyScoutMessage] = useState('');
  const [locationMessage, setLocationMessage] = useState('');
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const nowRequestId = useRef(0);
  const routeRequestId = useRef(0);
  const surpriseRequestId = useRef(0);
  const homeRequestId = useRef(0);
  const savedRequestId = useRef(0);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) {
        const saved = JSON.parse(raw) as Partial<StoredState>;
        if (saved.preferences) setPreferences({ ...defaultPreferences, ...saved.preferences, interests: Array.isArray(saved.preferences.interests) ? saved.preferences.interests : defaultPreferences.interests, topics: normalizeTopics(saved.preferences.topics), travelModes: Array.isArray(saved.preferences.travelModes) ? saved.preferences.travelModes : defaultPreferences.travelModes, distanceUnit: saved.preferences.distanceUnit === 'mi' ? 'mi' : 'km', place: saved.preferences.place || 'Toronto, Canada' });
        if (saved.feedback) setFeedback(saved.feedback);
        if (Array.isArray(saved.likedExamples)) setLikedExamples(saved.likedExamples.filter(value => value && typeof value.id === 'string' && typeof value.title === 'string').slice(0, 12));
        else if (saved.feedback) setLikedExamples(sampleExperiences.filter(item => saved.feedback?.[item.id] === 'love').map(item => ({ id: item.id, title: item.title })).slice(0, 12));
        if (saved.savedIds) setSavedIds(saved.savedIds);
        if (Array.isArray(saved.savedItems)) setSavedItems(saved.savedItems.filter(item => item?.mode === 'live' && typeof item.id === 'string' && item.sourceUrl?.startsWith('https://')).slice(0, 100));
        if (Array.isArray(saved.savedWebIdeas)) setSavedWebIdeas(saved.savedWebIdeas.filter(idea => idea && typeof idea.id === 'string' && idea.sourceUrl?.startsWith('https://')).slice(0, 100));
        if (Array.isArray(saved.importedFinds)) setImportedFinds(saved.importedFinds.filter(find => find && typeof find.id === 'string' && typeof find.title === 'string').slice(0, 100));
      }
    }).catch(() => {}).finally(() => setHydrated(true));
  }, []);
  useEffect(() => {
    if (hydrated) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ preferences, feedback, savedIds, savedItems, savedWebIdeas, importedFinds, likedExamples })).catch(() => {});
  }, [preferences, feedback, savedIds, savedItems, savedWebIdeas, importedFinds, likedExamples, hydrated]);
  useEffect(() => { if (hydrated) syncImportedReminders(importedFinds).catch(() => setImportMessage('A saved reminder could not be scheduled on this phone.')); }, [hydrated, importedFinds]);
  useEffect(() => { setNowBudgetText(String(preferences.maxBudget)); }, [preferences.maxBudget]);
  useEffect(() => { const subscription = listenForSourceTaps(); return () => subscription.remove(); }, []);
  useEffect(() => {
    catalog.load().then(result => setExperiences(result.items)).catch(() => setExperiences([])).finally(() => setCatalogLoading(false));
  }, []);
  useEffect(() => { nowRequestId.current += 1; routeRequestId.current += 1; surpriseRequestId.current += 1; homeRequestId.current += 1; savedRequestId.current += 1; setRemoteSuggestions([]); setRemoteItems([]); setHomeWebIdeas([]); setSearchWebIdeas([]); setNowIdeas([]); setNowMessage(''); setNowLoading(false); setNowSearched(false); setRouteIdeas([]); setRouteMessage(''); setRouteLoading(false); setRouteSearched(false); setHomeScoutMessage(''); setHomeScoutCitations([]); setHomeLoading(false); setSavedScoutIdeas([]); setSavedScoutMessage(''); setSavedScoutLoading(false); setSavedScoutSeed(''); setActiveRequest(null); setDiscoverWide(false); setSerendipityPick(null); setSerendipityWebPick(null); setSerendipityMessage(''); setSerendipityLoading(false); setSerendipityTried(false); }, [preferences.place, preferences.currency]);
  useEffect(() => { if (!(preferences.travelModes ?? []).includes(travelMode) || travelMode === 'plane') setTravelMode((preferences.travelModes ?? []).find(mode => mode !== 'plane') ?? 'walk'); }, [preferences.travelModes, travelMode]);

  const furtherRadiusKm = Math.min(500, preferences.maxDistanceKm + toKilometres(25, preferences.distanceUnit));
  const discoverPreferences = useMemo(() => discoverWide ? { ...preferences, maxDistanceKm: furtherRadiusKm } : preferences, [discoverWide, preferences, furtherRadiusKm]);
  const showingTorontoSamples = (/^(toronto)(?:\b|,)/i.test(preferences.place.trim()) || /^ontario(?:,?\s*canada)?$/i.test(preferences.place.trim())) && preferences.currency === 'CAD';
  const localExamples = useMemo(() => showingTorontoSamples ? experiences : [], [experiences, showingTorontoSamples]);
  const allItems = useMemo(() => [...remoteItems, ...localExamples.filter(item => !remoteItems.some(remote => remote.id === item.id))], [remoteItems, localExamples]);
  const savedVisible = useMemo(() => {
    const byId = new Map([...savedItems, ...allItems].map(item => [item.id, item]));
    return [...byId.values()].filter(item => savedIds.includes(item.id));
  }, [savedItems, allItems, savedIds]);
  const ranked = useMemo(() => rankExperiences(allItems, discoverPreferences, feedback, savedIds), [allItems, discoverPreferences, feedback, savedIds]);
  const alerts = useMemo(() => opportunityAlerts(allItems, preferences, feedback, savedIds), [allItems, preferences, feedback, savedIds]);
  useEffect(() => {
    if (!hydrated || !remoteScoutConfigured || process.env.EXPO_PUBLIC_PBB_AUTO_SCOUT !== '1' || !preferences.place.includes(',') || !/^[A-Z]{3}$/.test(preferences.currency)) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setAutoScoutStatus('Your scout is checking for ideas…');
      setHomeScoutMessage('');
      setHomeScoutCitations([]);
      setHomeWebIdeas([]);
      try {
        const result = await askRemoteScout('Find experiences that match my saved interests and practical limits', preferences, 'balanced', undefined, undefined, false, likedExamples.map(value => value.title));
        if (cancelled) return;
        setRemoteItems(result.picks.map(pickToExperience));
        setHomeWebIdeas((result.ideas ?? []).filter(idea => feedback[idea.id] !== 'pass'));
        setHomeScoutMessage(result.message);
        setHomeScoutCitations(result.citations ?? []);
        setAutoScoutStatus(result.mode === 'web' ? 'Your scout checked the public web.' : result.mode === 'live' ? 'Your scout checked source-linked ideas.' : 'Your scout found sample ideas.');
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
  const agentSuggestions = useMemo(() => remoteScoutConfigured ? remoteSuggestions.map(suggestion => ({ item: suggestion.item, reasons: [suggestion.reason] })) : activeRequest === null ? [] : recommendForIntent(localExamples, discoverPreferences, feedback, savedIds, interpretIntent(activeRequest), agentMode).slice(0, 3), [localExamples, discoverPreferences, feedback, savedIds, activeRequest, agentMode, remoteSuggestions]);
  const visible = ranked.filter(item => (category === 'All' || item.category === category) && (!query || `${item.title} ${item.category} ${item.tags.join(' ')} ${item.location}`.toLowerCase().includes(query.toLowerCase())));
  const diverse = showDiverse ? [...visible].sort((a, b) => Number(preferences.interests.includes(a.category)) - Number(preferences.interests.includes(b.category))) : visible;
  const organicItems = diverse;
  const homeOrganicItems = showMoreIdeas || searchOpen || category !== 'All' || !!query.trim() ? organicItems : organicItems.slice(0, 3);
  const drawSerendipity = async () => {
    if (serendipityLoading) return;
    const requestId = ++surpriseRequestId.current;
    setSerendipityTried(true);
    setSerendipityMessage('');
    if (!remoteScoutConfigured) {
      setSerendipityPick(chooseSerendipity(allItems, preferences, feedback, travelMode, serendipityPick?.id));
      return;
    }
    setSerendipityLoading(true);
    setSerendipityPick(null);
    try {
      const scoutPreferences = surpriseSearchPreferences(preferences, travelMode);
      const result = await askRemoteScout('Surprise me with unusually fun or fascinating activities nearby. Ignore my usual likes and choose something different. Keep it within the requested radius and travel mode.', scoutPreferences, 'different', undefined, undefined, true);
      if (requestId !== surpriseRequestId.current) return;
      const ideas = (result.ideas ?? []).filter(idea => feedback[idea.id] !== 'pass');
      const fresh = ideas.length > 1 ? ideas.filter(idea => idea.id !== serendipityWebPick?.id) : ideas;
      setSerendipityWebPick(fresh.length ? fresh[Math.floor(Math.random() * fresh.length)] : null);
      setSerendipityMessage(result.message);
    } catch (error) {
      if (requestId === surpriseRequestId.current) { setSerendipityWebPick(null); setSerendipityMessage(error instanceof Error ? `The scout is unavailable: ${error.message}` : 'The scout is unavailable. Please try again.'); }
    } finally { if (requestId === surpriseRequestId.current) setSerendipityLoading(false); }
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
  const applyImportedCandidate = (find: ExtractedFind) => {
    setImportTitle(find.title);
    setImportDateText(find.dateText);
    setImportEventDate(find.eventDate);
    setImportEventTime(find.eventTime);
    setImportVenue(find.venue);
    setImportPlace(find.place || preferences.place);
    if (find.sourceUrl) setImportLink(find.sourceUrl);
    setImportReminderDate('');
    setImportReminderTime('');
    setEditingImportId(null);
    setImportMessage('Review the date and year before saving or setting a reminder.');
  };
  const pickImportedScreenshot = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.65, base64: Platform.OS === 'ios' });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (asset.mimeType !== 'image/jpeg' && asset.mimeType !== 'image/png' && asset.base64 && FileSystem.cacheDirectory) {
        const jpegUri = `${FileSystem.cacheDirectory}pbb-picked-${Date.now()}.jpg`;
        await FileSystem.writeAsStringAsync(jpegUri, asset.base64, { encoding: FileSystem.EncodingType.Base64 });
        setImportImageUri(jpegUri);
        setImportImageMime('image/jpeg');
      } else {
        setImportImageUri(asset.uri);
        setImportImageMime(asset.mimeType ?? 'image/png');
      }
      setImportCandidates([]);
      setImportMessage('Image selected. Tap Read image to pull out the possible events.');
    } catch { setImportMessage('The photo library could not open. Try again from Photos.'); }
  };
  const readImportedFind = async (kind: 'image' | 'link') => {
    if (importBusy) return;
    const sourceUrl = safeSourceUrl(importLink);
    if (kind === 'link' && !sourceUrl) { setImportMessage('Paste a public HTTPS link first.'); return; }
    if (kind === 'image' && !importImageUri) { setImportMessage('Choose or share a photo or screenshot first.'); return; }
    setImportBusy(true);
    setImportCandidates([]);
    setImportMessage(kind === 'image' ? 'Reading the image, then checking the public web…' : 'Checking the public link…');
    try {
      let scan;
      if (kind === 'image') {
        if (importImageMime !== 'image/jpeg' && importImageMime !== 'image/png') throw new Error('Choose a PNG or JPEG image.');
        const imageBase64 = await FileSystem.readAsStringAsync(importImageUri!, { encoding: FileSystem.EncodingType.Base64 });
        if (imageBase64.length > 4_000_000) throw new Error('This image is too large. Crop it and try again.');
        scan = await scanSharedFind({ imageBase64, imageMime: importImageMime, sourceUrl: sourceUrl ?? undefined, place: preferences.place });
      } else scan = await scanSharedFind({ sourceUrl: sourceUrl!, place: preferences.place });
      const finds = scan.finds;
      setImportCandidates(finds);
      if (finds.length === 1) applyImportedCandidate(finds[0]);
      const sourced = finds.filter(find => !!find.sourceUrl).length;
      const lookupMessage = scan.webLookup === 'matched' ? ` Public sources found for ${sourced}.` : scan.webLookup === 'no-match' ? ' Public web search found no reliable matching page.' : scan.webLookup === 'failed' ? ' Public web lookup could not finish; these details are unconfirmed.' : '';
      setImportMessage(finds.length ? `${finds.length} possible ${finds.length === 1 ? 'event' : 'events'} found.${lookupMessage} Choose one and confirm its details.` : 'This post could not be read reliably. You can still enter and save its details below.');
    } catch (error) { setImportMessage(error instanceof Error ? error.message : 'The scout could not read this find. Enter its details below.'); }
    finally { setImportBusy(false); }
  };
  const editImportedFind = (find: ImportedFind) => {
    setEditingImportId(find.id);
    setImportTitle(find.title);
    setImportDateText(find.dateText);
    setImportEventDate(find.eventDate);
    setImportEventTime(find.eventTime);
    setImportVenue(find.venue);
    setImportPlace(find.place);
    setImportLink(find.sourceUrl ?? '');
    setImportImageUri(find.imageUri);
    setImportImageMime(find.imageUri?.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
    if (find.reminderAt) { const parts = localInputParts(new Date(find.reminderAt)); setImportReminderDate(parts.date); setImportReminderTime(parts.time); }
    else { setImportReminderDate(''); setImportReminderTime(''); }
    setImportOpen(true);
    setTab('Saved');
    setImportMessage('Edit and save this find. Dates from posts still need confirmation.');
    scrollRef.current?.scrollTo({ y: 350, animated: true });
  };
  const saveImportedFind = async () => {
    const title = importTitle.trim();
    if (!title) { setImportMessage('Add an event name before saving.'); return; }
    const sourceUrl = importLink.trim() ? safeSourceUrl(importLink) : null;
    if (importLink.trim() && !sourceUrl) { setImportMessage('The source link must start with https://.'); return; }
    if (importEventDate.trim() && !parseLocalDate(importEventDate)) { setImportMessage('Enter the event date as YYYY-MM-DD, including the year.'); return; }
    if (importEventTime.trim() && (!importEventDate.trim() || !parseLocalDateTime(importEventDate, importEventTime))) { setImportMessage('Enter a valid event date and time, using HH:MM.'); return; }
    let reminderAt: string | null = null;
    if (importReminderDate.trim() || importReminderTime.trim()) {
      const reminder = parseLocalDateTime(importReminderDate, importReminderTime);
      if (!reminder || reminder.getTime() <= Date.now() + 60_000) { setImportMessage('Choose a future reminder date and time.'); return; }
      const event = importEventDate ? parseLocalDateTime(importEventDate, importEventTime || '23:59') : null;
      if (event && reminder.getTime() >= event.getTime()) { setImportMessage('Set the reminder before the event.'); return; }
      if (!(await requestPhoneAlerts())) { setImportMessage('Allow notifications on this phone to set the reminder, or clear its date and save without one.'); return; }
      reminderAt = reminder.toISOString();
    }
    setImportBusy(true);
    try {
      const old = importedFinds.find(find => find.id === editingImportId);
      const id = editingImportId ?? `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const imageUri = importImageUri && !importImageUri.includes('/imported-finds/') ? await keepImportedScreenshot(importImageUri, id, importImageMime) : importImageUri;
      const next: ImportedFind = { id, title, dateText: importDateText.trim(), eventDate: importEventDate.trim(), eventTime: importEventTime.trim(), venue: importVenue.trim(), place: importPlace.trim() || preferences.place, sourceUrl, imageUri, savedAt: old?.savedAt ?? new Date().toISOString(), reminderAt };
      setImportedFinds(current => [next, ...current.filter(find => find.id !== id)].slice(0, 100));
      if (old?.imageUri && old.imageUri !== imageUri) void removeImportedScreenshot(old.imageUri);
      setEditingImportId(null); setImportTitle(''); setImportDateText(''); setImportEventDate(''); setImportEventTime(''); setImportVenue(''); setImportPlace(''); setImportReminderDate(''); setImportReminderTime('');
      setImportMessage(`Saved ${title} to Saved.${reminderAt ? ' Your phone reminder is set.' : ''}`);
    } catch { setImportMessage('This find could not be saved on the phone. Please try again.'); }
    finally { setImportBusy(false); }
  };
  const removeImportedFind = (find: ImportedFind) => {
    setImportedFinds(current => current.filter(item => item.id !== find.id));
    void removeImportedScreenshot(find.imageUri);
  };
  const importedFindCard = (find: ImportedFind) => <View key={find.id} style={styles.importedCard}>
    {find.imageUri ? <Image source={{ uri: find.imageUri }} style={styles.importedImage} resizeMode="cover" /> : null}
    <Text style={styles.webKicker}>SAVED BY YOU · DETAILS TO CONFIRM</Text>
    <Text style={styles.webTitle}>{find.title}</Text>
    <Text style={styles.webMeta}>{find.eventDate || find.dateText || 'Date not confirmed'}{find.eventTime ? ` · ${find.eventTime}` : ''}</Text>
    <Text style={styles.webVenue}>{find.venue || find.place}</Text>
    {find.reminderAt ? <Text style={styles.importedReminder}>◷ Reminder: {new Date(find.reminderAt).toLocaleString()}</Text> : null}
    <View style={styles.cardActions}>
      {find.sourceUrl ? <Action label="Go to post ↗" onPress={() => { void Linking.openURL(find.sourceUrl!); }} small /> : null}
      <Action label="Edit / remind" onPress={() => editImportedFind(find)} secondary small />
      <Action label="Add to calendar" onPress={() => { void addImportedFindToCalendar(find).catch(error => Alert.alert('Calendar', error instanceof Error ? error.message : 'The calendar could not open.')); }} secondary small />
      <Pressable onPress={() => removeImportedFind(find)} style={styles.textAction}><Text style={styles.textActionLabel}>Remove</Text></Pressable>
    </View>
    <Text style={styles.webDisclaimer}>This came from a shared post or screenshot. Check the organizer's current listing before booking or travelling.</Text>
  </View>;
  const toggleSaved = (item: Experience) => {
    const alreadySaved = savedIds.includes(item.id);
    setSavedIds(current => current.includes(item.id) ? current.filter(value => value !== item.id) : [...current, item.id]);
    if (item.mode === 'live') setSavedItems(current => alreadySaved ? current.filter(value => value.id !== item.id) : [item, ...current.filter(value => value.id !== item.id)].slice(0, 100));
  };
  const toggleInterest = (value: Category) => setPreferences(current => ({ ...current, interests: current.interests.includes(value) ? current.interests.filter(item => item !== value) : [...current.interests, value] }));
  const toggleTopic = (value: string) => setPreferences(current => ({ ...current, topics: current.topics.includes(value) ? current.topics.filter(item => item !== value) : normalizeTopics([...current.topics, value]) }));
  const addCustomInterest = (value = customInterestText) => {
    const topic = value.trim().replace(/\s+/g, ' ');
    if (preferences.topics.some(existing => existing.toLocaleLowerCase() === topic.toLocaleLowerCase())) { setCustomInterestMessage('This interest is already selected.'); return; }
    const next = normalizeTopics([...preferences.topics, topic]);
    if (next.length === preferences.topics.length) { setCustomInterestMessage('Use 2–40 letters or numbers, with spaces or simple punctuation. You can add up to 12 named interests.'); return; }
    setPreferences(current => ({ ...current, topics: normalizeTopics([...current.topics, topic]) }));
    setCustomInterestText('');
    setCustomInterestMessage('');
  };
  const toggleTravel = (value: TravelMode) => setPreferences(current => ({ ...current, travelModes: current.travelModes.includes(value) ? current.travelModes.filter(item => item !== value) : [...current.travelModes, value] }));
  const setNumber = (key: 'maxBudget', value: string) => {
    const number = Number(value.replace(/[^0-9]/g, ''));
    setPreferences(current => ({ ...current, [key]: Number.isFinite(number) ? number : 0 }));
  };
  const setRadius = (value: string) => {
    const number = Number(value.replace(/[^0-9]/g, ''));
    setDiscoverWide(false);
    setPreferences(current => ({ ...current, maxDistanceKm: Math.max(0, Math.min(500, toKilometres(Number.isFinite(number) ? number : 0, current.distanceUnit))) }));
  };
  const runScout = async (prompt: string, refinement: DiscoveryMode = 'balanced') => {
    setActiveRequest(prompt);
    setAgentMode(refinement);
    setScoutMessage('');
    setScoutCitations([]);
    setSearchWebIdeas([]);
    if (!remoteScoutConfigured) { setScoutMessage('Preview mode: showing matching sample ideas below. Live AI search is not connected yet.'); return; }
    if (!preferences.place.trim() || !/^[A-Z]{3}$/.test(preferences.currency)) { setScoutMessage('Enter a city, country, and three-letter currency in Settings first.'); return; }
    setScoutLoading(true);
    try {
      const result = await askRemoteScout(prompt, discoverPreferences, refinement, undefined, undefined, false, likedExamples.map(value => value.title));
      const suggestions = result.picks.map(pick => ({ item: pickToExperience(pick), reason: pick.reason }));
      setRemoteSuggestions(suggestions);
      setRemoteItems(current => [...suggestions.map(suggestion => suggestion.item), ...current.filter(item => !suggestions.some(suggestion => suggestion.item.id === item.id))]);
      setSearchWebIdeas((result.ideas ?? []).filter(idea => feedback[idea.id] !== 'pass'));
      setScoutMessage(result.message);
      setScoutCitations(result.citations ?? []);
    } catch (error) {
      setRemoteSuggestions([]);
      setScoutMessage(error instanceof Error ? `The scout is unavailable: ${error.message}` : 'The scout is unavailable. Please try again.');
    } finally { setScoutLoading(false); }
  };
  const runHomeScout = async (searchPreferences: Preferences = discoverPreferences) => {
    if (homeLoading) return;
    const requestId = ++homeRequestId.current;
    setHomeLoading(true);
    setHomeScoutMessage('');
    setHomeScoutCitations([]);
    setHomeWebIdeas([]);
    if (!remoteScoutConfigured) { setHomeScoutMessage('Live discovery is not connected in this preview. Explore the sample ideas below.'); setHomeLoading(false); return; }
    try {
      const farther = searchPreferences.maxDistanceKm > preferences.maxDistanceKm;
      const prompt = farther ? 'Look a little further for current activities in nearby towns and areas within my wider travel radius. Match my saved interests and budget. Prioritize specific source-linked options I can plan soon.' : 'Find current activities that match my saved interests, budget and travel preferences. Prioritize specific source-linked options I can plan soon.';
      const result = await askRemoteScout(prompt, searchPreferences, 'balanced', undefined, undefined, false, likedExamples.map(value => value.title));
      if (requestId !== homeRequestId.current) return;
      setHomeWebIdeas((result.ideas ?? []).filter(idea => feedback[idea.id] !== 'pass'));
      setHomeScoutMessage(result.message);
      setHomeScoutCitations(result.citations ?? []);
    } catch (error) {
      if (requestId === homeRequestId.current) setHomeScoutMessage(error instanceof Error ? `The scout is unavailable: ${error.message}` : 'The scout is unavailable. Please try again.');
    } finally { if (requestId === homeRequestId.current) setHomeLoading(false); }
  };
  const runNowScout = async (hours: number) => {
    const requestId = ++nowRequestId.current;
    setNowIdeas([]);
    setNowMessage('');
    setNowSearched(true);
    if (!remoteScoutConfigured) { setNowMessage('Live ideas for today are not connected in this preview.'); return; }
    if (!preferences.place.trim() || !/^[A-Z]{3}$/.test(preferences.currency)) { setNowMessage('Set your city and currency in Settings first.'); return; }
    const searchBudget = Number(nowBudgetText);
    if (!nowBudgetText.trim() || !Number.isFinite(searchBudget) || searchBudget < 0 || searchBudget > 10000) { setNowMessage('Enter a budget from 0 to 10,000 for today.'); return; }
    setNowLoading(true);
    try {
      const focus = nowFocus === 'Anything' ? '' : ` Focus on ${nowFocus.toLowerCase()} activities.`;
      const result = await askRemoteScout(`Find something I can do today in ${hours} hours, including travel. Use only source-supported same-day dates or opening hours.${focus}`, { ...preferences, maxBudget: searchBudget }, 'balanced', hours, undefined, false, likedExamples.map(value => value.title));
      if (requestId !== nowRequestId.current) return;
      setNowIdeas((result.ideas ?? []).filter(idea => feedback[idea.id] !== 'pass'));
      setNowMessage(result.message);
    } catch (error) {
      if (requestId === nowRequestId.current) setNowMessage(error instanceof Error ? `The scout is unavailable: ${error.message}` : 'The scout is unavailable. Please try again.');
    } finally { if (requestId === nowRequestId.current) setNowLoading(false); }
  };
  const resetRouteResults = () => { routeRequestId.current += 1; setRouteIdeas([]); setRouteMessage(''); setRouteLoading(false); setRouteSearched(false); };
  const runRouteScout = async () => {
    const requestId = ++routeRequestId.current;
    const nextDestination = destination.trim();
    setRouteSearched(true);
    setRouteIdeas([]);
    if (nextDestination.length < 3) { setRouteMessage('Tell your scout where you are heading first.'); return; }
    if (!remoteScoutConfigured) { setRouteMessage('Live route discovery is not connected in this preview.'); return; }
    if (!preferences.travelModes.includes('car')) { setRouteMessage('Turn on Cars in Settings to search along a driving route.'); return; }
    if (routeStyle !== 'either' && !routeVia.trim()) { setRouteMessage(routeStyle === 'highway' ? 'Which highway are you taking?' : 'Which town could you go through?'); return; }
    setRouteLoading(true);
    setRouteMessage('');
    const route: RouteSearch = { destination: nextDestination, style: routeStyle, via: routeVia, detourMinutes, timing: routeTiming };
    try {
      const focus = routeFocus === 'Best stop' ? '' : ` Focus on ${routeFocus.toLowerCase()} stops.`;
      const prompt = `Find interesting source-linked stops along my driving route using my route answers, interests and budget.${focus}`;
      const result = await askRemoteScout(prompt, preferences, 'balanced', undefined, route, false, likedExamples.map(value => value.title));
      if (requestId !== routeRequestId.current) return;
      setRouteIdeas((result.ideas ?? []).filter(idea => feedback[idea.id] !== 'pass'));
      setRouteMessage(result.message);
    } catch (error) {
      if (requestId === routeRequestId.current) setRouteMessage(error instanceof Error ? `The scout is unavailable: ${error.message}` : 'The scout is unavailable. Please try again.');
    } finally { if (requestId === routeRequestId.current) setRouteLoading(false); }
  };
  const runSavedScout = async (title: string) => {
    if (savedScoutLoading) return;
    const requestId = ++savedRequestId.current;
    setSavedScoutSeed(title);
    setSavedScoutIdeas([]);
    setSavedScoutMessage('');
    if (!remoteScoutConfigured) { setSavedScoutMessage('Live discovery is not connected in this preview. Your saved ideas remain here.'); return; }
    setSavedScoutLoading(true);
    try {
      const result = await askRemoteScout(`Find current activities near my chosen place that feel like “${title}”. Respect my budget, travel range and interests. Show source-linked alternatives.`, preferences, 'balanced', undefined, undefined, false, [title, ...likedExamples.map(value => value.title)]);
      if (requestId !== savedRequestId.current) return;
      setSavedScoutIdeas((result.ideas ?? []).filter(idea => feedback[idea.id] !== 'pass' && !savedWebIdeas.some(saved => saved.id === idea.id)));
      setSavedScoutMessage(result.message);
    } catch (error) {
      if (requestId === savedRequestId.current) setSavedScoutMessage(error instanceof Error ? `The scout is unavailable: ${error.message}` : 'The scout is unavailable. Please try again.');
    } finally { if (requestId === savedRequestId.current) setSavedScoutLoading(false); }
  };
  const toggleLove = (id: string, title: string) => {
    const wasLoved = feedback[id] === 'love';
    setFeedback(current => { const next = { ...current }; if (wasLoved) delete next[id]; else next[id] = 'love'; return next; });
    setLikedExamples(current => wasLoved ? current.filter(value => value.id !== id) : [{ id, title }, ...current.filter(value => value.id !== id)].slice(0, 12));
  };
  const itemCard = (item: Experience) => <Card key={item.id} item={item} distanceUnit={preferences.distanceUnit} saved={savedIds.includes(item.id)} loved={feedback[item.id] === 'love'} onOpen={() => setSelected(item)} onSave={() => toggleSaved(item)} onLove={() => toggleLove(item.id, item.title)} onPass={() => { setFeedback(current => ({ ...current, [item.id]: 'pass' })); setLikedExamples(current => current.filter(value => value.id !== item.id)); setSavedIds(current => current.filter(id => id !== item.id)); setSavedItems(current => current.filter(value => value.id !== item.id)); setLastPassed({ item, wasSaved: savedIds.includes(item.id) }); }} />;
  const webIdeaCard = (idea: WebIdea, journeyDestination?: string) => {
    const saved = savedWebIdeas.some(item => item.id === idea.id);
    const venueAddress = idea.address ? `${idea.venue}, ${idea.address}` : `${idea.venue}, ${idea.place}`;
    const directions = journeyDestination ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(preferences.place)}&destination=${encodeURIComponent(journeyDestination)}&waypoints=${encodeURIComponent(venueAddress)}&travelmode=driving` : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(venueAddress)}`;
    const sourceName = idea.sourceUrl.replace(/^https:\/\//, '').split('/')[0];
    return <View key={idea.id} style={styles.webCard}>
      <Text style={styles.webKicker}>✦  FOUND FOR YOU · PUBLIC SOURCE</Text>
      <Text style={styles.webTitle}>{idea.title}</Text>
      <Text style={styles.webMeta} numberOfLines={2}>{[idea.dateText, idea.priceText].filter(Boolean).join(' · ') || 'Check the source for dates and cost'}</Text>
      <Text style={styles.webVenue}>{idea.venue}{idea.address ? ` · ${idea.address}` : ` · ${idea.place}`}</Text>
      <Text style={styles.webSource}>Source: {sourceName}</Text>
      <View style={styles.cardActions}>
        <Action label="Go to site ↗" onPress={() => { void Linking.openURL(idea.sourceUrl); }} small />
        <Action label={journeyDestination ? 'Check route' : 'Directions'} onPress={() => { void Linking.openURL(directions); }} secondary small />
        <Action label={saved ? 'Saved ✓' : 'Save'} onPress={() => setSavedWebIdeas(current => saved ? current.filter(item => item.id !== idea.id) : [idea, ...current].slice(0, 100))} secondary small />
        <Pressable onPress={() => toggleLove(idea.id, idea.title)} style={styles.textAction}><Text style={styles.textActionLabel}>{feedback[idea.id] === 'love' ? 'Loved ✓' : 'Love'}</Text></Pressable>
        <Pressable onPress={() => { setFeedback(current => ({ ...current, [idea.id]: 'pass' })); setLikedExamples(current => current.filter(value => value.id !== idea.id)); setHomeWebIdeas(current => current.filter(item => item.id !== idea.id)); setSearchWebIdeas(current => current.filter(item => item.id !== idea.id)); setNowIdeas(current => current.filter(item => item.id !== idea.id)); setRouteIdeas(current => current.filter(item => item.id !== idea.id)); setSavedScoutIdeas(current => current.filter(item => item.id !== idea.id)); setSerendipityWebPick(current => current?.id === idea.id ? null : current); setSavedWebIdeas(current => current.filter(item => item.id !== idea.id)); }} style={styles.textAction}><Text style={styles.textActionLabel}>Pass</Text></Pressable>
      </View>
      {idea.reason ? <Text style={styles.webReason} numberOfLines={2}>WHY IT FITS · {idea.reason}</Text> : null}
      <Text style={styles.webSummary} numberOfLines={3}>{idea.summary}</Text>
      <Text style={styles.webDisclaimer}>Confirm the date, availability, price and weather with the organizer before leaving.</Text>
    </View>;
  };
  const undoPass = () => {
    if (!lastPassed) return;
    setFeedback(current => { const next = { ...current }; delete next[lastPassed.item.id]; return next; });
    if (lastPassed.wasSaved) setSavedIds(current => current.includes(lastPassed.item.id) ? current : [...current, lastPassed.item.id]);
    if (lastPassed.wasSaved && lastPassed.item.mode === 'live') setSavedItems(current => [lastPassed.item, ...current.filter(item => item.id !== lastPassed.item.id)].slice(0, 100));
    setLastPassed(null);
  };
  const receiveShare = (imageUri: string | null, imageMime: string, url: string | null) => {
    setImportOpen(true);
    setTab('Saved');
    setImportCandidates([]);
    setEditingImportId(null);
    setImportImageUri(imageUri);
    setImportImageMime(imageMime);
    setImportLink(url ?? '');
    setImportTitle('');
    setImportDateText('');
    setImportEventDate('');
    setImportEventTime('');
    setImportVenue('');
    setImportPlace('');
    setImportReminderDate('');
    setImportReminderTime('');
    setImportMessage('Shared from another app. Read it, then review the details before saving.');
  };

  if (!hydrated) return <SafeAreaView style={styles.safe}><View style={styles.loading}><Text style={styles.brand}>PB&B ✦</Text><Text style={styles.lead}>Getting your ideas ready…</Text></View></SafeAreaView>;
  return <SafeAreaView style={styles.safe}><StatusBar style="dark" />
    <IncomingShareBoundary><IncomingShare onReceive={receiveShare} /></IncomingShareBoundary>
    <View style={styles.header}><View style={styles.brandRow}><Image source={require('./assets/pbb-mountain-mark.png')} style={styles.brandMark} accessibilityLabel="PB&B mountain explorer taking a photo" /><View style={styles.brandInfo}><Text style={styles.brand}>PB&B</Text><Text style={styles.brandSub} numberOfLines={1}>Exploring {preferences.place || 'anywhere'}</Text></View></View><Pressable onPress={() => setTab('Settings')} style={styles.settingsButton} accessibilityRole="button" accessibilityLabel="Open settings"><Text style={styles.settingsButtonText}>⚙  Settings</Text></Pressable></View>
    <ScrollView ref={scrollRef} key={selected?.id ?? tab} style={styles.content} contentContainerStyle={styles.contentInner} keyboardShouldPersistTaps="handled">
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
        <Text style={styles.homeLead}>{showingTorontoSamples ? 'Toronto sample ideas appear below. Featured destinations link to real organizer listings.' : homeWebIdeas.length || homeScoutCitations.length ? `Your scout found source-linked ideas for ${preferences.place}. Check each source before making plans.` : remoteScoutConfigured ? `Ask your scout to check current public sources for activities that fit your settings in ${preferences.place}.` : `No source-linked ideas for ${preferences.place} yet. The live web scout is being connected.`}</Text>
        <Action label={homeLoading ? 'Scouting for you…' : 'Find ideas for me'} onPress={() => { void runHomeScout(); }} />
        {homeLoading && <Text style={styles.notice}>Checking public sources near {preferences.place}…</Text>}
        {autoScoutStatus ? <Text style={styles.scoutStatus}>✦  {autoScoutStatus}</Text> : null}
        {homeWebIdeas.length ? <Text style={styles.webIntro}>{homeScoutMessage}</Text> : homeScoutCitations.length ? <CitedScoutText message={homeScoutMessage} citations={homeScoutCitations} /> : homeScoutMessage ? <Text style={styles.notice}>{homeScoutMessage}</Text> : null}
        {homeWebIdeas.map(idea => webIdeaCard(idea))}
        {furtherRadiusKm > preferences.maxDistanceKm && <Pressable onPress={() => { if (homeLoading) return; const nextWide = !discoverWide; setDiscoverWide(nextWide); setShowMoreIdeas(nextWide); void runHomeScout(nextWide ? { ...preferences, maxDistanceKm: furtherRadiusKm } : preferences); }} disabled={homeLoading} style={[styles.lookFurther, discoverWide && styles.lookFurtherActive]} accessibilityRole="button" accessibilityState={{ disabled: homeLoading }}><View style={styles.lookFurtherCopy}><Text style={styles.lookFurtherTitle}>{discoverWide ? 'Back to nearby' : 'Look a little further'}</Text><Text style={styles.lookFurtherDetail}>{discoverWide ? `Wider Discover range: about ${formatDistance(furtherRadiusKm, preferences.distanceUnit)}. Your saved range is ${formatDistance(preferences.maxDistanceKm, preferences.distanceUnit)}.` : `Ask your scout to look about ${formatDistance(furtherRadiusKm, preferences.distanceUnit)} from ${preferences.place.split(',')[0].trim() || 'your city'}. Your saved range stays ${formatDistance(preferences.maxDistanceKm, preferences.distanceUnit)}.`}</Text></View><Text style={styles.lookFurtherArrow}>{discoverWide ? '↩' : '→'}</Text></Pressable>}
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
            {searchWebIdeas.length ? <Text style={styles.webIntro}>{scoutMessage}</Text> : scoutCitations.length ? <CitedScoutText message={scoutMessage} citations={scoutCitations} /> : scoutMessage ? <Text style={styles.notice}>{scoutMessage}</Text> : null}
            {scoutLoading ? <Text style={styles.notice}>Your scout is looking…</Text> : searchWebIdeas.length ? searchWebIdeas.map(idea => webIdeaCard(idea)) : scoutCitations.length ? null : agentSuggestions.length ? agentSuggestions.map(suggestion => <View key={suggestion.item.id}><Text style={styles.whyText}>WHY IT FITS · {suggestion.reasons.join(' · ')}</Text>{itemCard(suggestion.item)}</View>) : <View style={styles.empty}><Text style={styles.emptyTitle}>{showingTorontoSamples && !remoteScoutConfigured ? 'No close match in these sample ideas.' : `No verified match for ${preferences.place} yet.`}</Text><Text style={styles.summary}>{showingTorontoSamples && !remoteScoutConfigured ? 'Try another interest, more time, a larger budget, or a wider radius.' : 'Try another interest or adjust your budget or radius. Real listings need verified organizer sources.'}</Text></View>}
            <View style={styles.chipRow}><Pill label="Something different" active={agentMode === 'different'} onPress={() => runScout(activeRequest, 'different')} /><Pill label="Cheaper" active={agentMode === 'cheaper'} onPress={() => runScout(activeRequest, 'cheaper')} /><Pill label="Closer" active={agentMode === 'closer'} onPress={() => runScout(activeRequest, 'closer')} /></View>
          </View>}
        </View>}
        <Pressable onPress={() => setSerendipityOpen(value => !value)} style={styles.serendipityToggle} accessibilityRole="button" accessibilityState={{ expanded: serendipityOpen }}><View><Text style={styles.serendipityTitle}>✦  Serendipity</Text><Text style={styles.serendipitySubtitle}>Let something wonderful find you</Text></View><Text style={styles.serendipityChevron}>{serendipityOpen ? '−' : '+'}</Text></Pressable>
        {serendipityOpen && <View style={styles.serendipityPanel}>
          <Text style={styles.serendipityIntro}>A wild card near you. Your scout sets aside your usual likes and looks for something cool, fun or unexpected.</Text>
          <Text style={styles.label}>How would you get there?</Text><View style={styles.chipRow}>{(preferences.travelModes ?? []).filter(mode => mode !== 'plane').map(mode => <Pill key={mode} label={travelModeLabels[mode]} active={travelMode === mode} onPress={() => { surpriseRequestId.current += 1; setTravelMode(mode); setSerendipityPick(null); setSerendipityWebPick(null); setSerendipityMessage(''); setSerendipityLoading(false); setSerendipityTried(false); }} />)}</View>
          {!preferences.travelModes.some(mode => mode !== 'plane') && <Text style={styles.notice}>Choose walking or another local travel option in Settings first.</Text>}
          <Text style={styles.serendipityRule}>{travelMode === 'walk' ? `A walkable surprise within ${formatDistance(5, preferences.distanceUnit)}.` : `An unexpected idea within ${formatDistance(30, preferences.distanceUnit)}. Check the route before going.`} Your saved interests do not steer this pick.</Text>
          {preferences.travelModes.some(mode => mode !== 'plane') && <Action label={serendipityLoading ? 'Finding your wild card…' : 'Surprise me'} onPress={() => { void drawSerendipity(); }} />}
          {serendipityLoading && <Text style={styles.notice}>Looking for a fresh surprise near {preferences.place}…</Text>}
          {serendipityWebPick && <View><Text style={styles.whyText}>YOUR WILD CARD · CHECK THE SOURCE</Text>{webIdeaCard(serendipityWebPick)}</View>}
          {serendipityPick && <View><Text style={styles.whyText}>YOUR {travelMode.toUpperCase()} SURPRISE · SAMPLE IDEA</Text>{itemCard(serendipityPick)}</View>}
          {serendipityTried && !serendipityLoading && !serendipityPick && !serendipityWebPick && <Text style={styles.notice}>{serendipityMessage || `No ${travelMode} surprise has a reliable source near ${preferences.place} yet. Try another way to travel.`}</Text>}
        </View>}
        {alerts.length > 0 && <Pressable onPress={() => setTab('Settings')} style={styles.alertBanner}><Text style={styles.alertBannerTitle}>✦ {alerts.length} timely {alerts.length === 1 ? 'find' : 'finds'} for you</Text><Text style={styles.alertBannerBody}>See what fits your interests →</Text></Pressable>}
        <View style={styles.rowBetween}><Text style={styles.subheading}>{showDiverse ? 'A different direction' : showingTorontoSamples ? 'Toronto sample ideas' : 'Local ideas for you'}</Text><Text style={styles.resultCount}>{homeOrganicItems.length} shown</Text></View>
        {catalogLoading ? <Text style={styles.notice}>Loading ideas…</Text> : homeOrganicItems.length ? homeOrganicItems.map(item => <View key={item.id}><Text style={styles.whyText}>{fitReason(item)}</Text>{itemCard(item)}</View>) : homeWebIdeas.length || homeScoutCitations.length ? <Text style={styles.helper}>Open each source above to check the latest details with the organizer.</Text> : <View style={styles.empty}><Text style={styles.emptyTitle}>No ideas here yet.</Text><Text style={styles.summary}>{remoteScoutConfigured ? 'Try another interest, budget, or travel radius in Settings.' : 'Live web discoveries are not connected in this preview yet.'}</Text></View>}
        <View style={styles.featuredSection}><View style={styles.rowBetween}><Text style={styles.featuredKicker}>WORTH THE TRIP</Text><Text style={styles.featuredBadge}>PB&B PICKS</Text></View><Text style={styles.featuredDisclosure}>Real paid experiences selected by PB&B. No organizer paid for placement. Prices and availability were checked November 8, 2026; confirm them on the official page before booking.</Text>
          {featuredDestinations.map(destination => <FeaturedDestinationCard key={destination.id} destination={destination} />)}
        </View>
        {!showMoreIdeas && organicItems.length > 3 && !searchOpen && <Action label="See more local ideas" onPress={() => setShowMoreIdeas(true)} secondary />}
        <Action label={showDiverse ? 'Back to your picks' : 'Show me something different'} onPress={() => setShowDiverse(value => !value)} secondary />
        <Text style={styles.footerNote}>Sample idea photos are illustrative. Featured destination photos come from their organizers when available.</Text>
      </View> : tab === 'Now' ? <View>
        <Text style={styles.sectionKicker}>SPONTANEOUS</Text><Text style={styles.h1}>What can I do today?</Text><Text style={styles.lead}>Your scout looks for source-linked ideas near {preferences.place} that fit the time you have, your interests and your budget.</Text>
        <Text style={styles.label}>Time available, including travel</Text><View style={styles.chipRow}>{[1, 2, 3, 5].map(value => <Pill key={value} label={`${value} hr`} active={timeHours === value} onPress={() => { nowRequestId.current += 1; setTimeHours(value); setNowIdeas([]); setNowMessage(''); setNowLoading(false); }} />)}</View>
        <Text style={styles.label}>What sounds good right now?</Text><View style={styles.chipRow}>{nowFocuses.map(value => <Pill key={value} label={value} active={nowFocus === value} onPress={() => { nowRequestId.current += 1; setNowFocus(value); setNowIdeas([]); setNowMessage(''); setNowLoading(false); }} />)}</View>
        <Text style={styles.label}>Today’s budget ({preferences.currency})</Text><TextInput value={nowBudgetText} onChangeText={value => { nowRequestId.current += 1; setNowBudgetText(value.replace(/[^0-9]/g, '').slice(0, 5)); setNowIdeas([]); setNowMessage(''); setNowLoading(false); }} keyboardType="number-pad" placeholder="0 for free" placeholderTextColor="#6C8285" style={styles.nowBudgetInput} accessibilityLabel={`Today's budget in ${preferences.currency}`} />
        <Action label={nowLoading ? 'Looking for today…' : `Find ideas for ${timeHours} hr today`} onPress={() => { if (!nowLoading) void runNowScout(timeHours); }} />
        {nowLoading ? <Text style={styles.notice}>Checking public sources for today’s possibilities…</Text> : nowIdeas.length ? <><Text style={styles.webIntro}>{nowMessage}</Text>{nowIdeas.map(idea => webIdeaCard(idea))}</> : nowMessage ? <View style={styles.empty}><Text style={styles.emptyTitle}>{nowMessage.startsWith('No source-linked') ? 'No match for today yet.' : 'Today’s scout needs another try.'}</Text><Text style={styles.summary}>{nowMessage}</Text><Text style={styles.helper}>Try more time or a wider travel radius in Settings.</Text></View> : null}
        <Text style={styles.footerNote}>Check the organizer’s site before leaving. Hours, availability, weather and prices can change.</Text>
      </View> : tab === 'Along the Way' ? <View>
        <Text style={styles.sectionKicker}>A LITTLE DETOUR</Text><Text style={styles.h1}>One good stop on the way.</Text><Text style={styles.lead}>Your scout can look between {preferences.place} and your destination. Tell it how you want to travel.</Text>
        <Text style={styles.label}>Where are you heading?</Text><TextInput value={destination} onChangeText={value => { setDestination(value.slice(0, 120)); resetRouteResults(); }} placeholder="Destination city, country" placeholderTextColor="#6C8285" style={styles.search} />
        <Text style={styles.label}>Which way are you going?</Text><View style={styles.chipRow}><Pill label="Highway" active={routeStyle === 'highway'} onPress={() => { setRouteStyle('highway'); setRouteVia(''); resetRouteResults(); }} /><Pill label="Through a town" active={routeStyle === 'towns'} onPress={() => { setRouteStyle('towns'); setRouteVia(''); resetRouteResults(); }} /><Pill label="Either way" active={routeStyle === 'either'} onPress={() => { setRouteStyle('either'); setRouteVia(''); resetRouteResults(); }} /></View>
        {routeStyle !== 'either' && <><Text style={styles.label}>{routeStyle === 'highway' ? 'Which highway are you taking?' : 'Which town could you go through?'}</Text><TextInput value={routeVia} onChangeText={value => { setRouteVia(value.slice(0, 100)); resetRouteResults(); }} placeholder={routeStyle === 'highway' ? 'Highway 401' : 'A town along the way'} placeholderTextColor="#6C8285" style={styles.search} /></>}
        <Text style={styles.label}>How long a detour would you take?</Text><View style={styles.chipRow}>{[0, 15, 30, 60].map(value => <Pill key={value} label={value === 0 ? 'On the route' : `${value} min`} active={detourMinutes === value} onPress={() => { setDetourMinutes(value); resetRouteResults(); }} />)}</View>
        <Text style={styles.label}>When are you travelling?</Text><View style={styles.chipRow}><Pill label="Today" active={routeTiming === 'today'} onPress={() => { setRouteTiming('today'); resetRouteResults(); }} /><Pill label="This weekend" active={routeTiming === 'weekend'} onPress={() => { setRouteTiming('weekend'); resetRouteResults(); }} /><Pill label="Just exploring" active={routeTiming === 'flexible'} onPress={() => { setRouteTiming('flexible'); resetRouteResults(); }} /></View>
        <Text style={styles.label}>What kind of stop?</Text><View style={styles.chipRow}>{routeFocuses.map(value => <Pill key={value} label={value} active={routeFocus === value} onPress={() => { setRouteFocus(value); resetRouteResults(); }} />)}</View>
        <Action label={routeLoading ? 'Looking along the way…' : 'Find a stop along the way'} onPress={() => { if (!routeLoading) void runRouteScout(); }} />
        {routeLoading ? <Text style={styles.notice}>Checking public sources along your proposed journey…</Text> : routeIdeas.length ? <><Text style={styles.webIntro}>{routeMessage}</Text>{routeIdeas.map(idea => webIdeaCard(idea, destination.trim()))}</> : routeSearched && routeMessage ? <View style={styles.empty}><Text style={styles.emptyTitle}>{routeMessage.startsWith('No source-linked') ? 'No stop found yet.' : 'Your scout needs a little more.'}</Text><Text style={styles.summary}>{routeMessage}</Text></View> : null}
        <Text style={styles.footerNote}>Stops are possibilities, not a calculated route. Open Check route to compare the actual drive and detour, and confirm the venue’s hours and availability.</Text>
      </View> : tab === 'Saved' ? <View>
        <Text style={styles.sectionKicker}>YOUR SHORTLIST</Text><Text style={styles.h1}>Saved for later.</Text><Text style={styles.lead}>Keep possibilities close across places. Recheck each live source before making plans.</Text>
        <Pressable onPress={() => setImportOpen(value => !value)} style={styles.importToggle} accessibilityRole="button" accessibilityState={{ expanded: importOpen }}><View style={styles.lookFurtherCopy}><Text style={styles.lookFurtherTitle}>Save a find from social media</Text><Text style={styles.lookFurtherDetail}>Share a post or screenshot to PB&B, choose a photo, or paste a link.</Text></View><Text style={styles.lookFurtherArrow}>{importOpen ? '−' : '+'}</Text></Pressable>
        {importOpen && <View style={styles.importPanel}>
          <Text style={styles.agentTitle}>Keep something you spotted.</Text>
          <Text style={styles.importHelp}>Share a post or image from Instagram, Facebook or another app, or choose a screenshot here. Your scout can read visible details and public links. You choose what to save.</Text>
          <Action label="Choose photo or screenshot" onPress={() => { void pickImportedScreenshot(); }} secondary />
          {importImageUri ? <><Image source={{ uri: importImageUri }} style={styles.importPreview} resizeMode="cover" /><Action label={importBusy ? 'Scanning and searching…' : 'Scan photo and search web'} onPress={() => { void readImportedFind('image'); }} small /></> : null}
          <Text style={styles.label}>Post or event link (optional)</Text>
          <TextInput value={importLink} onChangeText={setImportLink} placeholder="Paste a social post or organizer link" placeholderTextColor="#6C8285" autoCapitalize="none" keyboardType="url" style={styles.importInput} />
          <Text style={styles.importHelp}>Private posts may not be readable from a link. Share a screenshot if the scout cannot access it.</Text>
          {!!importLink.trim() && <Action label={importBusy ? 'Reading link…' : 'Read public link'} onPress={() => { void readImportedFind('link'); }} secondary small />}
          {importMessage ? <Text style={styles.notice}>{importMessage}</Text> : null}
          {importCandidates.length > 0 && <View><Text style={styles.subheading}>Possible finds in this post</Text>{importCandidates.map((candidate, index) => <Pressable key={`${candidate.title}-${index}`} onPress={() => applyImportedCandidate(candidate)} style={styles.importCandidate}><Text style={styles.importCandidateTitle}>{candidate.title}</Text><Text style={styles.helper}>{candidate.dateText || 'Date unclear'}{candidate.venue ? ` · ${candidate.venue}` : ''}{candidate.sourceUrl ? ' · Public source found' : ''}</Text><Text style={styles.alertLink}>Use this find →</Text></Pressable>)}</View>}
          <Text style={styles.subheading}>{editingImportId ? 'Edit this find' : 'Review and save one find'}</Text>
          <Text style={styles.label}>Name</Text><TextInput value={importTitle} onChangeText={setImportTitle} placeholder="Event or experience name" placeholderTextColor="#6C8285" style={styles.importInput} />
          <Text style={styles.label}>Date shown in post</Text><TextInput value={importDateText} onChangeText={setImportDateText} placeholder="For example, Nov 14–15" placeholderTextColor="#6C8285" style={styles.importInput} />
          <Text style={styles.label}>Confirmed event date · YYYY-MM-DD</Text><TextInput value={importEventDate} onChangeText={setImportEventDate} placeholder="Include the year after checking" placeholderTextColor="#6C8285" keyboardType="numbers-and-punctuation" style={styles.importInput} />
          <Text style={styles.label}>Start time · HH:MM (optional)</Text><TextInput value={importEventTime} onChangeText={setImportEventTime} placeholder="For example, 18:30" placeholderTextColor="#6C8285" keyboardType="numbers-and-punctuation" style={styles.importInput} />
          <Text style={styles.label}>Venue</Text><TextInput value={importVenue} onChangeText={setImportVenue} placeholder="Where is it?" placeholderTextColor="#6C8285" style={styles.importInput} />
          <Text style={styles.label}>City or area</Text><TextInput value={importPlace} onChangeText={setImportPlace} placeholder={preferences.place} placeholderTextColor="#6C8285" style={styles.importInput} />
          <Text style={styles.label}>Remind me (optional)</Text>
          <View style={styles.promptRow}>{[{ label: '1 week before', days: 7 }, { label: '3 days before', days: 3 }, { label: '1 day before', days: 1 }, { label: 'Day of', days: 0 }].map(option => <Pressable key={option.label} onPress={() => { const date = reminderSuggestion(importEventDate, importEventTime, option.days); if (!date) { setImportMessage('Confirm the event date first to choose a reminder.'); return; } const parts = localInputParts(date); setImportReminderDate(parts.date); setImportReminderTime(parts.time); }} style={styles.promptChip}><Text style={styles.promptText}>{option.label}</Text></Pressable>)}</View>
          <View style={styles.importDateRow}><TextInput value={importReminderDate} onChangeText={setImportReminderDate} placeholder="Reminder YYYY-MM-DD" placeholderTextColor="#6C8285" style={[styles.importInput, styles.importDateInput]} /><TextInput value={importReminderTime} onChangeText={setImportReminderTime} placeholder="HH:MM" placeholderTextColor="#6C8285" style={[styles.importInput, styles.importTimeInput]} /></View>
          <Text style={styles.importHelp}>A reminder uses this phone's local time and can be changed later. Calendar opens a review form after you save a confirmed date.</Text>
          <Action label={importBusy ? 'Saving…' : editingImportId ? 'Update saved find' : 'Save find'} onPress={() => { if (!importBusy) void saveImportedFind(); }} />
        </View>}
        {(savedWebIdeas.length > 0 || savedVisible.length > 0) && <View style={styles.agentPanel}><Text style={styles.agentKicker}>✦ KEEP EXPLORING</Text><Text style={styles.agentTitle}>More like this?</Text><Text style={styles.agentLead}>Choose a saved idea and your scout will look for current alternatives near {preferences.place}.</Text><View style={styles.promptRow}>{[...savedWebIdeas.map(idea => ({ id: idea.id, title: idea.title })), ...savedVisible.map(item => ({ id: item.id, title: item.title }))].slice(0, 8).map(item => <Pressable key={item.id} onPress={() => { void runSavedScout(item.title); }} style={styles.promptChip}><Text style={styles.promptText} numberOfLines={2}>{item.title}</Text></Pressable>)}</View></View>}
        {savedScoutLoading && <Text style={styles.notice}>Looking for more like {savedScoutSeed}…</Text>}
        {!savedScoutLoading && savedScoutMessage ? <Text style={styles.webIntro}>{savedScoutMessage}</Text> : null}
        {savedScoutIdeas.filter(idea => !savedWebIdeas.some(saved => saved.id === idea.id)).map(idea => webIdeaCard(idea))}
        {importedFinds.length > 0 && <View><Text style={styles.subheading}>Finds you brought in</Text>{importedFinds.map(importedFindCard)}</View>}
        {savedWebIdeas.map(idea => webIdeaCard(idea))}
        {savedVisible.map(itemCard)}
        {!savedVisible.length && !savedWebIdeas.length && !importedFinds.length && <View style={styles.empty}><Text style={styles.emptyTitle}>No saved ideas yet.</Text><Text style={styles.summary}>Save an experience from Discover to find it here.</Text><Action label="Explore ideas" onPress={() => setTab('Discover')} small /></View>}
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
        {topicsOpen && <View style={styles.searchPanel}><Text style={styles.label}>Your own interests</Text><Text style={styles.helper}>Add a fandom, author or story world you love. Try one of these or enter your own.</Text><View style={styles.chipRow}>{namedInterestSuggestions.filter(topic => !preferences.topics.includes(topic)).map(topic => <Pill key={topic} label={topic} onPress={() => { addCustomInterest(topic); }} />)}</View><TextInput value={customInterestText} onChangeText={setCustomInterestText} onSubmitEditing={() => addCustomInterest()} placeholder="For example, Harry Potter" placeholderTextColor="#6C8285" maxLength={40} returnKeyType="done" style={styles.search} /><Action label="Add interest" onPress={() => addCustomInterest()} small />{preferences.topics.filter(topic => !interestTopics.includes(topic as InterestTopic)).length > 0 && <View style={styles.chipRow}>{preferences.topics.filter(topic => !interestTopics.includes(topic as InterestTopic)).map(topic => <Pill key={topic} label={`${topic} ×`} active onPress={() => toggleTopic(topic)} />)}</View>}{customInterestMessage ? <Text style={styles.helper}>{customInterestMessage}</Text> : null}</View>}
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
  heroImage: { height: 156, borderRadius: 2, padding: 21, justifyContent: 'flex-end', marginBottom: 16, overflow: 'hidden' }, heroImageCorners: { borderRadius: 2 }, heroKicker: { color: '#B9ED5C', fontSize: 10, fontWeight: '900', letterSpacing: 1.6, marginBottom: 7 }, heroTitle: { color: '#FFFFFF', fontSize: 27, fontWeight: '900', lineHeight: 31, letterSpacing: -0.6, maxWidth: 190 },
  agentPanel: { backgroundColor: '#103D46', borderRadius: 2, padding: 22, marginBottom: 26, overflow: 'hidden' }, agentKicker: { color: '#B9ED5C', fontWeight: '900', letterSpacing: 1.4, fontSize: 11, marginBottom: 14 }, agentTitle: { color: '#FFFFFF', fontSize: 29, lineHeight: 34, fontWeight: '900', letterSpacing: -0.7, marginBottom: 8 }, agentLead: { color: '#E2F2EF', fontSize: 14, lineHeight: 20, marginBottom: 18 }, agentInput: { backgroundColor: '#FFFFFF', borderRadius: 2, color: ink, paddingHorizontal: 15, paddingVertical: 13, fontSize: 14, marginBottom: 10 }, promptRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, promptChip: { borderRadius: 2, backgroundColor: '#18565E', paddingHorizontal: 11, paddingVertical: 8 }, promptText: { color: '#F5F8F7', fontWeight: '700', fontSize: 11 }, agentResults: { marginBottom: 28 }, resultIntro: { color: muted, fontSize: 13, marginBottom: 15 }, whyText: { color: sea, fontWeight: '800', fontSize: 10, lineHeight: 15, letterSpacing: 0.4, marginBottom: 8 }, clearText: { color: sea, fontWeight: '800', fontSize: 12 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }, welcome: { padding: 24, paddingTop: 52, paddingBottom: 52, maxWidth: 650, width: '100%', alignSelf: 'center' }, welcomeTitle: { color: ink, fontSize: 38, lineHeight: 43, fontWeight: '900', letterSpacing: -1.5, marginBottom: 12 }, undoBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#E0F7F5', borderRadius: 12, padding: 13, marginBottom: 15 }, undoText: { color: ink, fontSize: 12, flex: 1, marginRight: 10 }, undoLink: { color: sea, fontWeight: '800', fontSize: 13 },
  brand: { color: ink, fontWeight: '900', fontSize: 25, letterSpacing: -1.5 }, brandStar: { color: '#18B8B0' }, brandRow: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }, brandMark: { width: 48, height: 48, marginRight: 6 }, brandInfo: { flex: 1, minWidth: 0 }, brandSub: { color: muted, fontSize: 11, letterSpacing: 0.3 }, avatar: { backgroundColor: '#DDF6F3', height: 38, width: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: sea, fontWeight: '800', fontSize: 10 },
  content: { flex: 1 }, contentInner: { padding: 22, paddingBottom: 40, maxWidth: 800, width: '100%', alignSelf: 'center' }, sectionKicker: { color: sea, fontWeight: '800', letterSpacing: 2, fontSize: 11, marginBottom: 10 }, h1: { color: ink, fontSize: 34, lineHeight: 39, fontWeight: '800', letterSpacing: -1.2, marginBottom: 10 }, lead: { color: muted, fontSize: 15, lineHeight: 22, marginBottom: 24 },
  alertBanner: { backgroundColor: '#FFF0EA', borderRadius: 18, padding: 18, marginBottom: 20 }, alertBannerTitle: { color: '#103D46', fontWeight: '800', fontSize: 17 }, alertBannerBody: { color: '#375F62', marginTop: 5, fontSize: 13 }, search: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D7E5E2', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, color: ink, fontSize: 14, marginBottom: 18 }, chipScroll: { marginBottom: 22 }, chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 }, pill: { paddingHorizontal: 15, paddingVertical: 9, borderRadius: 22, borderWidth: 1, borderColor: '#C9DCDA', backgroundColor: '#FFFFFF', marginRight: 7, marginBottom: 3 }, pillActive: { backgroundColor: '#18B8B0', borderColor: '#18B8B0' }, pillText: { color: '#103D46', fontWeight: '700', fontSize: 12 }, pillTextActive: { color: '#103D46' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, subheading: { color: ink, fontWeight: '800', fontSize: 21, marginBottom: 14 }, resultCount: { color: muted, fontSize: 12 }, card: { borderRadius: 2, backgroundColor: '#FFFFFF', overflow: 'hidden', borderWidth: 2, borderColor: '#18B8B0', marginBottom: 18 }, cardArt: { height: 110, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }, artGlyph: { color: '#FFFFFF', opacity: 0.9, fontSize: 72, lineHeight: 80, fontWeight: '200' }, artLabel: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', letterSpacing: 2 }, cardBody: { padding: 17 }, eyebrow: { color: sea, textTransform: 'uppercase', fontWeight: '800', fontSize: 10, letterSpacing: 0.9 }, cost: { color: ink, fontWeight: '800', fontSize: 12 }, cardTitle: { color: ink, fontWeight: '800', fontSize: 21, lineHeight: 26, marginTop: 8, marginBottom: 5 }, cardMeta: { color: muted, fontSize: 12, marginBottom: 10 }, summary: { color: '#45656B', fontSize: 14, lineHeight: 20 }, cardActions: { marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7 }, action: { backgroundColor: '#B9ED5C', borderRadius: 999, paddingHorizontal: 17, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }, actionSecondary: { backgroundColor: '#E9F9F5', borderWidth: 1, borderColor: '#C9E7E0' }, actionSmall: { paddingHorizontal: 12, paddingVertical: 10, marginBottom: 0 }, actionText: { color: '#103D46', fontWeight: '800', fontSize: 13 }, actionTextSecondary: { color: sea }, textAction: { paddingHorizontal: 6, paddingVertical: 10 }, textActionLabel: { color: sea, fontWeight: '700', fontSize: 12 },
  empty: { padding: 22, backgroundColor: '#FFFFFF', borderRadius: 18, marginBottom: 20 }, emptyTitle: { color: ink, fontWeight: '800', fontSize: 17, marginBottom: 6 }, footerNote: { color: '#61767A', fontSize: 11, textAlign: 'center', marginTop: 14 }, label: { color: ink, fontSize: 14, fontWeight: '700', marginBottom: 6 }, helper: { color: muted, fontSize: 11 }, notice: { backgroundColor: '#EAF6F4', color: '#103D46', borderRadius: 12, padding: 14, lineHeight: 19, fontSize: 12, marginBottom: 20 },
  back: { color: sea, fontWeight: '700', marginBottom: 18 }, detailArt: { borderRadius: 18, height: 190, alignItems: 'center', justifyContent: 'center', marginBottom: 22 }, detailGlyph: { color: '#FFFFFF', fontSize: 100, lineHeight: 110 }, detailCategory: { color: '#FFFFFF', fontWeight: '900', letterSpacing: 2 }, infoPanel: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, marginBottom: 20 }, infoText: { color: ink, fontSize: 14, marginBottom: 10 },
  alertCard: { backgroundColor: '#FFF0EA', padding: 18, borderRadius: 16, marginBottom: 12 }, alertTag: { color: '#BB4A34', fontWeight: '800', textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.8 }, alertTitle: { color: ink, fontSize: 17, fontWeight: '800', marginVertical: 8 }, alertLink: { color: sea, fontWeight: '800', fontSize: 12 }, settingsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderColor: '#E3E7E3' }, numberInput: { width: 76, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#C9DCDA', borderRadius: 10, textAlign: 'center', padding: 9, color: ink, fontWeight: '800' }, setting: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderColor: '#E3E7E3' }, toggle: { width: 44, height: 26, borderRadius: 13, backgroundColor: '#C9DCDA', padding: 3 }, toggleOn: { backgroundColor: '#18B8B0' }, toggleKnob: { width: 20, height: 20, backgroundColor: '#FFFFFF', borderRadius: 10 }, toggleKnobOn: { alignSelf: 'flex-end' },
  sourceHeading: { color: ink, fontWeight: '900', fontSize: 10, letterSpacing: 1.3, marginTop: 18, marginBottom: 9 }, sourceLink: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#C9E7E0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8 }, sourceLinkText: { color: sea, fontWeight: '800', fontSize: 13 },
  webIntro: { color: muted, fontSize: 14, lineHeight: 20, marginBottom: 14 }, webCard: { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#18B8B0', borderRadius: 2, padding: 18, marginBottom: 16 }, webKicker: { color: sea, fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginBottom: 9 }, webTitle: { color: ink, fontSize: 21, lineHeight: 26, fontWeight: '900', marginBottom: 8 }, webMeta: { color: ink, fontSize: 13, fontWeight: '800', marginBottom: 5 }, webVenue: { color: muted, fontSize: 12, marginBottom: 12 }, webReason: { color: sea, fontSize: 11, fontWeight: '800', marginBottom: 10 }, webSummary: { color: muted, fontSize: 13, lineHeight: 19 }, webSource: { color: sea, fontSize: 11, fontWeight: '700', marginTop: 14 }, webDisclaimer: { color: '#61767A', fontSize: 10, lineHeight: 15, marginTop: 8 },
  scoutStatus: { color: sea, fontSize: 11, fontWeight: '700', marginBottom: 12 }, deadlineText: { color: '#BB4A34', fontSize: 12, fontWeight: '800', marginBottom: 8 },
  importToggle: { backgroundColor: '#E6F7F3', borderWidth: 2, borderColor: '#103D46', borderRadius: 2, paddingHorizontal: 17, paddingVertical: 15, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }, importPanel: { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#18B8B0', borderRadius: 2, padding: 17, marginBottom: 22 }, importHelp: { color: muted, fontSize: 12, lineHeight: 18, marginBottom: 15 }, importInput: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#C9DCDA', borderRadius: 2, paddingHorizontal: 13, paddingVertical: 11, color: ink, fontSize: 14, marginBottom: 13 }, importPreview: { width: '100%', height: 180, borderRadius: 2, marginBottom: 12, backgroundColor: '#E6F7F3' }, importCandidate: { borderWidth: 1, borderColor: '#C9DCDA', backgroundColor: '#F4FBF9', padding: 13, marginBottom: 9 }, importCandidateTitle: { color: ink, fontWeight: '800', fontSize: 14, marginBottom: 3 }, importDateRow: { flexDirection: 'row', gap: 8 }, importDateInput: { flex: 2 }, importTimeInput: { flex: 1 }, importedCard: { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#18B8B0', borderRadius: 2, padding: 17, marginBottom: 16 }, importedImage: { width: '100%', height: 145, marginBottom: 13, borderRadius: 2 }, importedReminder: { color: sea, fontSize: 12, fontWeight: '800', marginTop: 8 },
  lookFurther: { backgroundColor: '#E6F7F3', borderWidth: 2, borderColor: '#18B8B0', borderRadius: 2, paddingHorizontal: 17, paddingVertical: 15, marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 12 }, lookFurtherActive: { backgroundColor: '#DDF2EE' }, lookFurtherCopy: { flex: 1 }, lookFurtherTitle: { color: ink, fontSize: 16, fontWeight: '900', marginBottom: 4 }, lookFurtherDetail: { color: muted, fontSize: 12, lineHeight: 18 }, lookFurtherArrow: { color: sea, fontSize: 22, fontWeight: '800' },
  homeIntro: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 8, marginBottom: 6 }, homeIntroText: { flex: 1 }, homeTitle: { color: ink, fontSize: 28, lineHeight: 32, fontWeight: '800', letterSpacing: -0.8 }, homeLead: { color: muted, fontSize: 13, lineHeight: 19, marginBottom: 16 }, placeButton: { paddingVertical: 8, paddingHorizontal: 9, borderRadius: 18, backgroundColor: '#E4F7F3', marginBottom: 4 }, placeButtonText: { color: sea, fontSize: 11, fontWeight: '800' },
  settingsButton: { backgroundColor: '#E1F4F0', borderRadius: 18, paddingHorizontal: 11, paddingVertical: 9 }, settingsButtonText: { color: sea, fontSize: 12, fontWeight: '800' }, searchToggle: { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#18B8B0', borderRadius: 2, paddingHorizontal: 17, paddingVertical: 14, marginBottom: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, searchToggleText: { color: ink, fontSize: 15, fontWeight: '800' }, searchChevron: { color: sea, fontSize: 23, lineHeight: 25, fontWeight: '500' }, searchPanel: { marginBottom: 14 },
  cardPhoto: { height: 180, justifyContent: 'flex-end', alignItems: 'flex-end', padding: 12 }, detailPhoto: { height: 230, borderRadius: 18, overflow: 'hidden', justifyContent: 'flex-end', alignItems: 'flex-end', padding: 12, marginBottom: 22 }, photoLabel: { color: '#FFFFFF', backgroundColor: 'rgba(16,61,70,0.78)', fontWeight: '800', fontSize: 9, letterSpacing: 0.8, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10 },
  nowBudgetInput: { width: 140, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#C9DCDA', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, color: ink, fontSize: 18, fontWeight: '800', marginBottom: 18 },
  serendipityToggle: { backgroundColor: '#B9ED5C', borderRadius: 2, borderWidth: 2, borderColor: '#103D46', paddingHorizontal: 18, paddingVertical: 15, marginBottom: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, serendipityTitle: { color: ink, fontSize: 17, fontWeight: '900' }, serendipitySubtitle: { color: ink, fontSize: 11, marginTop: 3 }, serendipityChevron: { color: ink, fontSize: 24 }, serendipityPanel: { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#18B8B0', borderRadius: 2, padding: 17, marginBottom: 20 }, serendipityIntro: { color: muted, fontSize: 14, lineHeight: 20, marginBottom: 18 }, serendipityRule: { color: muted, fontSize: 13, lineHeight: 19, marginBottom: 12 },
  planeTeaser: { height: 170, borderRadius: 18, overflow: 'hidden', justifyContent: 'flex-end', marginBottom: 10 }, planeTeaserShade: { backgroundColor: 'rgba(16,61,70,0.72)', padding: 14 }, planeTeaserKicker: { color: '#B9ED5C', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 }, planeTeaserTitle: { color: '#FFFFFF', fontSize: 18, lineHeight: 22, fontWeight: '900', maxWidth: 220, marginTop: 4 },
  featuredSection: { backgroundColor: '#E7F3F0', borderRadius: 2, borderWidth: 2, borderColor: '#103D46', padding: 14, marginBottom: 20 }, featuredKicker: { color: sea, fontSize: 10, fontWeight: '900', letterSpacing: 1.3 }, featuredBadge: { color: sea, fontSize: 10, fontWeight: '900', backgroundColor: '#B9ED5C', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 2 }, featuredDisclosure: { color: muted, fontSize: 11, lineHeight: 16, marginVertical: 10 }, featuredCard: { backgroundColor: '#FFFFFF', borderRadius: 2, overflow: 'hidden', marginBottom: 16, borderWidth: 2, borderColor: '#B9ED5C' }, featuredPhoto: { height: 190, justifyContent: 'flex-end', alignItems: 'flex-end', padding: 12 }, featuredCardBody: { padding: 17 }, featuredCardLabel: { color: sea, backgroundColor: '#B9ED5C', alignSelf: 'flex-start', borderRadius: 2, paddingHorizontal: 9, paddingVertical: 6, fontSize: 10, fontWeight: '900', letterSpacing: 0.7, marginBottom: 8 }, featuredDetail: { color: muted, fontSize: 12, lineHeight: 17, marginTop: 5 }, featuredPrice: { color: ink, fontSize: 13, fontWeight: '800', marginTop: 8 }, featuredLink: { alignSelf: 'flex-start', marginTop: 12 },
  tabBar: { flexDirection: 'row', borderTopWidth: 1, borderColor: '#DCE8E4', backgroundColor: '#FFFFFF', paddingBottom: 5, paddingTop: 6 }, tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 }, tabIcon: { color: '#667F82', fontSize: 22 }, tabText: { color: '#667F82', fontSize: 10, fontWeight: '700' }, tabActive: { color: sea },
});
