package com.smu.backend.controller;

import com.smu.backend.dto.SensorLogDTO;
import com.smu.backend.mapper.SensorLogMapper;
import com.smu.backend.service.KakaoGeoService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class GeoUpdateController {

    private final SensorLogMapper sensorLogMapper;
    private final KakaoGeoService kakaoGeoService;

    @GetMapping("/geo-update")
    public String updateAllCoordinates() {
        log.info("🔮 [지오코딩] 600개 맨홀 주소 -> 진짜 좌표 변환 작업을 시작합니다...");

        List<SensorLogDTO> locations = sensorLogMapper.getAllLocations();
        int successCount = 0;

        for (SensorLogDTO loc : locations) {
            // 서울시 API 주소 예시: 강서구 화곡로 336앞 맨홀<소암빌딩...>
            // 특수문자(< >)나 뒤에 붙은 "맨홀" 같은 잡음을 제거하고 순수 주소만 발라내면 카카오가 더 잘 찾아!
            String cleanAddress = loc.getName().split("<")[0].replace("맨홀", "").trim();

            // 카카오 API 호출
            double[] coords = kakaoGeoService.getCoordinates(cleanAddress);

            if (coords != null) {
                // 진짜 좌표로 DB 업데이트!
                sensorLogMapper.updateLocationCoordinate(loc.getLocationId(), coords[0], coords[1]);
                successCount++;
                log.info("📍 [{}] 변환 완료 -> 위도: {}, 경도: {}", cleanAddress, coords[0], coords[1]);
            } else {
                log.warn("⏭️ [{}] 좌표를 찾지 못해 건너뜁니다.", cleanAddress);
            }

            // 🚨 카카오 API 무료 트래픽 제한 및 서버 과부하 방지를 위해 0.05초씩 쉬면서 실행
            try { Thread.sleep(50); } catch (Exception ignored) {}
        }

        return "🎉 지오코딩 완료! 총 " + locations.size() + "개 중 " + successCount + "개의 좌표가 진짜 위치로 업데이트되었습니다.";
    }
}