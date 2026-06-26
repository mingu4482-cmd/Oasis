package com.smu.backend.controller;

import com.smu.backend.dto.SensorLogDTO;
import com.smu.backend.mapper.SensorLogMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/sensors")
@RequiredArgsConstructor
// 🌟 중요: 리액트 개발 서버(5173 포트)에서 오는 요청을 허용해주는 CORS 설정입니다. (안 하면 에러 남!)
@CrossOrigin(origins = "http://localhost:5173")
public class SensorLogController {

    private final SensorLogMapper sensorLogMapper;

    @GetMapping("/latest")
    public List<SensorLogDTO> getLatestSensorLogs() {
        // DB에서 각 지역별 최신 수위 데이터를 리스트로 싹 긁어와서 반환합니다.
        return sensorLogMapper.getLatestLogsForAllLocations();
    }
}