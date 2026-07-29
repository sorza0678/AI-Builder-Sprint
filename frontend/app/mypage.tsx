import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppButton, Card, commonStyles, ListingCard, ScreenContainer, SectionHeader } from '@/src/components/common';
import { getRecentListings, getSavedListings } from '@/src/services/listing-service';
import { Listing } from '@/src/types/marketplace';

export default function MyPageScreen() {
  const [recent, setRecent] = useState<Listing[]>([]);
  const [saved, setSaved] = useState<Listing[]>([]);
  useEffect(() => { let active = true; Promise.all([getRecentListings(), getSavedListings()]).then(([a, b]) => { if (active) { setRecent(a); setSaved(b); } }); return () => { active = false; }; }, []);
  return <ScreenContainer><Text style={commonStyles.title}>마이페이지</Text><Card><Text style={commonStyles.label}>Mock 사용자</Text><Text style={commonStyles.muted}>buyer@example.com</Text></Card><View style={commonStyles.row}><Card style={{ flex: 1 }}><Text style={commonStyles.label}>분석</Text><Text style={commonStyles.title}>{recent.length}</Text></Card><Card style={{ flex: 1 }}><Text style={commonStyles.label}>찜</Text><Text style={commonStyles.title}>{saved.length}</Text></Card></View><View style={commonStyles.row}><Card style={{ flex: 1 }}><Text style={commonStyles.label}>비교 중</Text><Text style={commonStyles.title}>2</Text></Card><Card style={{ flex: 1 }}><Text style={commonStyles.label}>거래 완료</Text><Text style={commonStyles.title}>1</Text></Card></View><SectionHeader title="최근 분석 기록" />{recent.slice(0, 2).map((item) => <ListingCard key={item.id} listing={item} />)}<SectionHeader title="저장한 매물" />{saved.map((item) => <ListingCard key={item.id} listing={item} />)}<SectionHeader title="거래 준비 중" />{recent.slice(0, 1).map((item) => <ListingCard key={item.id} listing={item} />)}<AppButton title="설정 (준비 중)" variant="secondary" onPress={() => undefined} /><AppButton title="로그아웃" variant="danger" onPress={() => router.replace('/login')} /><AppButton title="홈으로" variant="secondary" onPress={() => router.replace('/home')} /></ScreenContainer>;
}
