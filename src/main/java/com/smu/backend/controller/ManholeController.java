package com.smu.backend.controller;

import com.smu.backend.dto.SensorLogDTO;
import com.smu.backend.mapper.SensorLogMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@CrossOrigin(origins = "*") // 🚨 리액트(5173)가 스프링(8080)에 접근할 수 있게 허용!
public class ManholeController {

    private final SensorLogMapper sensorLogMapper;

    @GetMapping("/manholes")
    public List<SensorLogDTO> getManholes() {
        log.info("📡 프론트엔드에서 실시간 맨홀 데이터 요청 들어옴!");
        List<SensorLogDTO> list = sensorLogMapper.getLatestManholeData();
        log.info("📦 총 {} 개의 맨홀 데이터를 전송합니다.", list.size());
        return list;
    }
}