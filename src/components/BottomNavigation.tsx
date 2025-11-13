import { useNavigate, useLocation } from 'react-router-dom'
import homeSelected from '../assets/navigation/homeSelected.svg'
import homeUnselected from '../assets/navigation/homeUnselected.svg'
import contentSelected from '../assets/navigation/ContentSelected.svg'
import contentsUnselected from '../assets/navigation/ContentsUnselected.svg'
import profileSelected from '../assets/navigation/ProfileSelected.svg'
import profileUnselected from '../assets/navigation/ProfileUnselected.svg'

export default function BottomNavigation() {
  const navigate = useNavigate()
  const location = useLocation()

  const isActive = (path: string) => {
    return location.pathname === path
  }
  const isPrefixActive = (prefix: string) => {
    return location.pathname.startsWith(prefix)
  }

  return (
    <div className="w-full h-14 relative overflow-visible flex items-center justify-center gap-3">
      {/* 프로필 탭 (왼쪽) */}
      <button
        className={`w-16 h-14 rounded-[40px] backdrop-blur-md bg-white/3 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0px_0px_4px_0px_rgba(0,0,0,0.05)] border border-white/5 overflow-hidden cursor-pointer flex items-center justify-center transition-all hover:bg-white/10 ${
          isActive('/mypage') ? 'bg-white/10' : ''
        }`}
        onClick={() => navigate('/mypage')}
      >
        <img
          src={isActive('/mypage') ? profileSelected : profileUnselected}
          alt="profile"
          className="w-[18px] h-[18px]"
        />
      </button>

      {/* 홈 탭 (가운데) */}
      <button
        className={`w-28 h-14 rounded-[40px] backdrop-blur-md bg-white/3 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0px_0px_4px_0px_rgba(0,0,0,0.05)] border border-white/5 overflow-hidden cursor-pointer flex items-center justify-center transition-all hover:bg-white/10 ${
          isActive('/main') || isActive('/') ? 'bg-white/10' : ''
        }`}
        onClick={() => navigate('/main')}
      >
        <img
          src={isActive('/main') || isActive('/') ? homeSelected : homeUnselected}
          alt="home"
          className="w-[18px] h-[18px]"
        />
      </button>

      {/* 콘텐츠 탭 (오른쪽) */}
      <button
        className={`w-16 h-14 rounded-[40px] backdrop-blur-md bg-white/3 shadow-[0_8px_32px_0_rgba(0,0,0,0.03),inset_0px_0px_4px_0px_rgba(0,0,0,0.05)] border border-white/5 overflow-hidden cursor-pointer flex items-center justify-center transition-all hover:bg-white/10 ${
          isPrefixActive('/content') ? 'bg-white/10' : ''
        }`}
        onClick={() => navigate('/content')}
      >
        <img
          src={isPrefixActive('/content') ? contentSelected : contentsUnselected}
          alt="contents"
          className="w-[18px] h-[18px]"
        />
      </button>
    </div>
  )
}

