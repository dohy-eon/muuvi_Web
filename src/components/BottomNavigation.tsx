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
    <div className="w-full h-14 left-0 top-[722px] absolute overflow-hidden">
      {/* 프로필 탭 (왼쪽) */}
      <div
        className={`w-16 h-14 left-[39px] top-0 absolute rounded-[40px] shadow-[inset_0px_0px_4px_0px_rgba(0,0,0,0.25)] overflow-hidden cursor-pointer flex items-center justify-center ${
          isActive('/mypage') ? '' : ''
        }`}
        onClick={() => navigate('/mypage')}
      >
        <img
          src={isActive('/mypage') ? profileSelected : profileUnselected}
          alt="profile"
          className="w-[18px] h-[18px]"
        />
      </div>

      {/* 홈 탭 (가운데) */}
      <div
        className={`w-28 h-14 left-[127px] top-0 absolute rounded-[40px] shadow-[inset_0px_0px_4px_0px_rgba(0,0,0,0.25)] overflow-hidden cursor-pointer flex items-center justify-center`}
        onClick={() => navigate('/main')}
      >
        <img
          src={isActive('/main') || isActive('/') ? homeSelected : homeUnselected}
          alt="home"
          className="w-[18px] h-[18px]"
        />
      </div>

      {/* 콘텐츠 탭 (오른쪽) */}
      <div
        className={`w-16 h-14 left-[263px] top-0 absolute rounded-[40px] shadow-[inset_0px_0px_4px_0px_rgba(0,0,0,0.25)] overflow-hidden cursor-pointer flex items-center justify-center ${
          isPrefixActive('/content') ? '' : ''
        }`}
        
      >
        <img
          src={isPrefixActive('/content') ? contentSelected : contentsUnselected}
          alt="contents"
          className="w-[18px] h-[18px]"
        />
      </div>
    </div>
  )
}

