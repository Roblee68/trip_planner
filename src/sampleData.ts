import { daysFromNow, type Experience } from './logic';

// Illustrative listings only. Dates roll forward to keep the demo usable.
export const sampleExperiences: Experience[] = [
  {
    id: 'sketch-walk', travel: { modes: ['car', 'train', 'transit'] }, title: 'Neighbourhood sketch walk', category: 'Arts', format: 'Casual outing',
    summary: 'A relaxed walk with a few stops to sketch what catches your eye. Bring a notebook and pencil.',
    location: 'High Park', distanceKm: 7, totalCost: 0, durationHours: 1,
    startsAt: daysFromNow(1), listedAt: daysFromNow(-1), tags: ['creative', 'outdoors', 'free'], alongWay: true, accent: '#18B8B0',
  },
  {
    id: 'ballroom', travel: { modes: ['car', 'train', 'transit'] }, title: 'Beginner ballroom: six-week series', category: 'Dance', format: 'Class series',
    summary: 'Try waltz, foxtrot, and swing in a welcoming small group. No partner required in this sample listing.',
    location: 'West Toronto', distanceKm: 8, totalCost: 95, durationHours: 1.5,
    startsAt: daysFromNow(14), signupBy: daysFromNow(9), listedAt: daysFromNow(-1), tags: ['beginner', 'evening', 'series'], alongWay: false, accent: '#FF7759',
  },
  {
    id: 'line-dance', travel: { modes: ['walk', 'car', 'train', 'transit'] }, title: 'Free intro to line dancing', category: 'Dance', format: 'One-time lesson',
    summary: 'A low-pressure chance to learn the basics and meet other beginners.',
    location: 'Downtown Toronto', distanceKm: 5, totalCost: 0, durationHours: 1,
    startsAt: daysFromNow(5), listedAt: daysFromNow(-2), tags: ['beginner', 'free', 'weekend'], alongWay: false, accent: '#103D46',
  },
  {
    id: 'pottery', travel: { modes: ['car', 'train', 'transit'] }, title: 'Make your own ceramic mug', category: 'Arts', format: 'Workshop',
    summary: 'An introductory hand-building session with materials included.',
    location: 'The Junction', distanceKm: 9, totalCost: 48, durationHours: 2,
    startsAt: daysFromNow(10), listedAt: daysFromNow(-3), tags: ['creative', 'hands-on'], alongWay: false, accent: '#18B8B0',
  },
  {
    id: 'birdwalk', travel: { modes: ['car', 'train', 'transit'] }, title: 'Sunrise birding walk', category: 'Outdoors', format: 'Guided walk',
    summary: 'Explore a nearby ravine and learn to recognize local birds by sight and sound.',
    location: 'Humber River', distanceKm: 12, totalCost: 12, durationHours: 2,
    startsAt: daysFromNow(7), listedAt: daysFromNow(-1), tags: ['nature', 'morning'], alongWay: true, accent: '#103D46',
  },
  {
    id: 'night-market', travel: { modes: ['car', 'train', 'transit'] }, title: 'Neighbourhood night market', category: 'Food', format: 'Drop-in',
    summary: 'Browse small food vendors and live performances. Admission is free; food costs extra.',
    location: 'North York', distanceKm: 18, totalCost: 0, durationHours: 2,
    startsAt: daysFromNow(3), listedAt: daysFromNow(-1), tags: ['free admission', 'evening'], alongWay: true, accent: '#FF7759',
  },
  {
    id: 'printmaking', travel: { modes: ['car', 'train', 'transit'] }, title: 'Printmaking for curious beginners', category: 'Learning', format: 'Workshop',
    summary: 'Learn a simple printmaking process and take home your first piece.',
    location: 'East Toronto', distanceKm: 15, totalCost: 65, durationHours: 3,
    startsAt: daysFromNow(18), listedAt: daysFromNow(-5), tags: ['creative', 'beginner'], alongWay: false, accent: '#18B8B0',
  },
  {
    id: 'forest-bath', travel: { modes: ['car', 'train', 'transit'] }, title: 'Guided forest pause', category: 'Wellness', format: 'Guided outing',
    summary: 'A gentle outdoor session focused on slowing down and noticing the landscape.',
    location: 'High Park', distanceKm: 7, totalCost: 25, durationHours: 1.5,
    startsAt: daysFromNow(12), listedAt: daysFromNow(-4), tags: ['gentle', 'outdoors'], alongWay: true, accent: '#103D46',
  },
];
