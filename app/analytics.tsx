import React, { useEffect, useState } from 'react';
import { Alert, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { colors } from '../constants/colors';
import { Dream, loadDreams, saveDreams } from '../utils/storage';

const { width: SCREEN_W } = Dimensions.get('window');

interface AnalyticsProps {
  dreams: Dream[];
  onDreamsChange: (dreams: Dream[]) => void;
}

export default function Analytics({ dreams, onDreamsChange }: AnalyticsProps) {
  const [localDreams, setLocalDreams] = useState<Dream[]>(dreams);
  const [debugDreamCount, setDebugDreamCount] = useState(10);

  useEffect(() => {
    setLocalDreams(dreams);
  }, [dreams]);

  // Calculate dreams per week over time
  const getWeeklyDreamData = () => {
    const weeks: { [key: string]: number } = {};
    
    localDreams.forEach(dream => {
      const date = new Date(dream.dateISO);
      const weekKey = getWeekKey(date);
      weeks[weekKey] = (weeks[weekKey] || 0) + 1;
    });

    // Remove duplicates by using a Set
    const uniqueWeeks = Array.from(new Set(Object.keys(weeks)));
    
    const sortedWeeks = uniqueWeeks.sort((a, b) => {
      const [yearA, weekA] = a.split('-W').map(Number);
      const [yearB, weekB] = b.split('-W').map(Number);
      if (yearA !== yearB) return yearA - yearB;
      return weekA - weekB;
    });
    const last8Weeks = sortedWeeks.slice(-8);
    
    // Get current week
    const now = new Date();
    const currentWeekKey = getWeekKey(now);
    
    const labels = last8Weeks.map(weekKey => {
      const [year, week] = weekKey.split('-W');
      const isCurrent = weekKey === currentWeekKey;
      // Only show year if it's different from the current year
      const currentYear = now.getFullYear();
      const showYear = parseInt(year) !== currentYear;
      return isCurrent 
        ? `${showYear ? year + ' ' : ''}W${week} •` 
        : `${showYear ? year + ' ' : ''}W${week}`;
    });
    
    const data = last8Weeks.map(week => weeks[week] || 0);
    
    console.log('Week data:', last8Weeks.map(week => ({ week, count: weeks[week] })));
    console.log('Data array:', data);
    console.log('Labels:', labels);

    // Calculate trend line (simple moving average)
    const trend = data.map((_, i) => {
      const window = Math.min(3, i + 1);
      const slice = data.slice(Math.max(0, i - window + 1), i + 1);
      return slice.reduce((a, b) => a + b, 0) / slice.length;
    });

    return { labels, data, trend };
  };

  const getWeekKey = (date: Date): string => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const year = d.getFullYear();
    const onejan = new Date(year, 0, 1);
    const weekNumber = Math.ceil((((d.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);
    return `${year}-W${weekNumber}`;
  };

  const generateDebugDreams = async () => {
    const randomWords = [
      'flying', 'falling', 'chasing', 'running', 'swimming', 'flying', 'teeth', 'school',
      'house', 'forest', 'beach', 'mountain', 'city', 'ocean', 'sky', 'night', 'day',
      'friend', 'family', 'stranger', 'animal', 'monster', 'treasure', 'escape', 'lost',
      'found', 'hidden', 'secret', 'magic', 'power', 'fear', 'joy', 'sadness', 'anger',
      'love', 'hate', 'peace', 'war', 'death', 'birth', 'transformation', 'journey',
    ];

    const randomTitles = [
      'The Flying Dream', 'Lost in the Forest', 'Chasing Shadows', 'The Hidden Door',
      'Ocean Depths', 'Mountain Peak', 'Nightmare', 'Sweet Escape', 'The Secret Garden',
      'Time Travel', 'The Old House', 'The Stranger', 'Animal Kingdom', 'The Treasure',
      'The Escape', 'The Transformation', 'The Journey', 'The Magic World', 'The Lost City',
    ];

    const newDreams: Dream[] = [];
    const now = new Date();
    const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    for (let i = 0; i < debugDreamCount; i++) {
      const randomDays = Math.floor(Math.random() * 90);
      const dreamDate = new Date(threeMonthsAgo.getTime() + randomDays * 24 * 60 * 60 * 1000);
      
      const randomTitle = randomTitles[Math.floor(Math.random() * randomTitles.length)];
      const randomWordCount = Math.floor(Math.random() * 15) + 5;
      const randomDescription = Array.from({ length: randomWordCount }, () =>
        randomWords[Math.floor(Math.random() * randomWords.length)]
      ).join(' ');

      const randomVividness = Math.floor(Math.random() * 5) + 1;
      const randomTags = Array.from({ length: Math.floor(Math.random() * 3) }, () =>
        randomWords[Math.floor(Math.random() * randomWords.length)]
      );

      const newDream: Dream = {
        id: `debug-${i}-${Date.now()}`,
        title: randomTitle,
        description: randomDescription,
        date: dreamDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        dateISO: dreamDate.toISOString().split('T')[0],
        vividness: randomVividness,
        tags: randomTags,
        noMemory: Math.random() > 0.8,
      };

      newDreams.push(newDream);
    }

    const currentDreams = await loadDreams();
    const allDreams = [...currentDreams, ...newDreams].sort((a, b) => 
      new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime()
    );
    await saveDreams(allDreams);
    setLocalDreams(allDreams);
    onDreamsChange(allDreams);
    Alert.alert('Debug', `Generated ${newDreams.length} random dreams`);
  };

  const { labels, data, trend } = getWeeklyDreamData();

  const chartConfig = {
    backgroundColor: 'transparent',
    backgroundGradientFrom: 'transparent',
    backgroundGradientTo: 'transparent',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(167, 139, 250, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: colors.primaryPurple,
    },
    propsForBackgroundLines: {
      strokeDasharray: '4,4',
      stroke: 'rgba(255, 255, 255, 0.1)',
    },
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Dream Recall</Text>
      <Text style={styles.subtitle}>Dreams per week over time</Text>

      <TouchableOpacity
        style={styles.debugButton}
        onPress={generateDebugDreams}
      >
        <Text style={styles.debugButtonText}>Generate {debugDreamCount} debug dreams</Text>
      </TouchableOpacity>

      <View style={styles.stepperContainer}>
        <TouchableOpacity
          style={styles.stepperButton}
          onPress={() => setDebugDreamCount(Math.max(1, debugDreamCount - 1))}
        >
          <Text style={styles.stepperButtonText}>-</Text>
        </TouchableOpacity>
        <Text style={styles.stepperValue}>{debugDreamCount}</Text>
        <TouchableOpacity
          style={styles.stepperButton}
          onPress={() => setDebugDreamCount(Math.min(50, debugDreamCount + 1))}
        >
          <Text style={styles.stepperButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {data.length > 0 ? (
        <View style={styles.chartContainer}>
          <View style={styles.axisTitleContainer}>
            <Text style={styles.yAxisTitle}>Dreams</Text>
          </View>
          <LineChart
            data={{
              labels,
              datasets: [
                {
                  data,
                  color: (opacity = 1) => `rgba(167, 139, 250, ${opacity})`,
                  strokeWidth: 2,
                },
                {
                  data: trend,
                  color: (opacity = 1) => `rgba(251, 191, 36, ${opacity})`,
                  strokeWidth: 2,
                  withDots: false,
                },
              ],
            }}
            width={SCREEN_W - 80}
            height={220}
            chartConfig={chartConfig}
            bezier
            style={styles.chart}
            withInnerLines={true}
            withOuterLines={false}
            withVerticalLines={true}
            withHorizontalLines={true}
          />
          <View style={styles.xAxisTitleContainer}>
            <Text style={styles.xAxisTitle}>Week</Text>
          </View>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.primaryPurple }]} />
              <Text style={styles.legendText}>Dreams per week</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#fbbf24' }]} />
              <Text style={styles.legendText}>Trend (avg)</Text>
            </View>
          </View>
        </View>
      ) : (
        <Text style={styles.noData}>No dream data yet</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    padding: 20,
    paddingTop: 40,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Nunito_800ExtraBold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Nunito_300Light',
    color: colors.textMuted,
    marginBottom: 24,
  },
  chartContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
  },
  axisTitleContainer: {
    position: 'absolute',
    left: -12,
    top: 110,
    bottom: 0,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  yAxisTitle: {
    fontSize: 12,
    fontFamily: 'Nunito_600SemiBold',
    color: colors.textMuted,
    transform: [{ rotate: '-90deg' }],
  },
  xAxisTitleContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  xAxisTitle: {
    fontSize: 12,
    fontFamily: 'Nunito_600SemiBold',
    color: colors.textMuted,
  },
  chart: {
    borderRadius: 16,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    fontFamily: 'Nunito_600SemiBold',
    color: colors.textMuted,
  },
  noData: {
    fontSize: 16,
    fontFamily: 'Nunito_300Light',
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 40,
  },
  debugButton: {
    backgroundColor: 'rgba(167, 139, 250, 0.2)',
    borderWidth: 1,
    borderColor: colors.primaryPurple,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  debugButtonText: {
    fontSize: 14,
    fontFamily: 'Nunito_600SemiBold',
    color: colors.primaryPurple,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 20,
  },
  stepperButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(167, 139, 250, 0.2)',
    borderWidth: 1,
    borderColor: colors.primaryPurple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonText: {
    fontSize: 18,
    fontFamily: 'Nunito_800ExtraBold',
    color: colors.primaryPurple,
  },
  stepperValue: {
    fontSize: 16,
    fontFamily: 'Nunito_600SemiBold',
    color: colors.textPrimary,
    minWidth: 30,
    textAlign: 'center',
  },
});
